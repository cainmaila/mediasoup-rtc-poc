<template>
  <div class="poc">
    <div>{{ PEER_ID }}:{{ store.name }}</div>
    <hr />
    <div v-for="user in store.users" :key="user.id">{{ user.displayName }}</div>
    <video playsinline autoplay id="vod" width="460" height="306" />
  </div>
</template>
<script>
import protooClient from 'protoo-client'
import * as mediasoupClient from 'mediasoup-client'
import { onMounted, reactive } from 'vue'
import Lazy from 'lazy.js'
const PEER_ID = ~~(Math.random() * 1000)
const SERVICE = `wss://dev.webrtc.anchorgo.io:4443/?roomId=cainroom&peerId=${PEER_ID}`
const PC_PROPRIETARY_CONSTRAINTS = {
  optional: [{ googDscp: true }],
}
export default {
  name: 'Poc',
  setup() {
    const store = reactive({
      recvTransport: null,
      name:
        new URLSearchParams(new URL(window.location.href).search).get('name') ||
        'No Name',
      users: null,
      track: null,
    })
    const protooTransport = new protooClient.WebSocketTransport(SERVICE)
    const _protoo = new protooClient.Peer(protooTransport)
    _protoo.on('open', () => console.log('#open'))
    _protoo.on('failed', () => console.log('#failed'))
    _protoo.on('disconnected', () => console.log('#disconnected'))
    _protoo.on('close', () => console.log('#close'))
    // _protoo.on('request', async (request, accept, reject) => {
    _protoo.on('request', async (request, accept) => {
      // console.log('#request', request.method, accept, reject)
      console.log('#request', request.method)
      if (request.method === 'newConsumer') {
        const {
          peerId,
          producerId,
          id,
          kind,
          rtpParameters,
          // type,
          appData,
          // producerPaused,
        } = request.data
        const consumer = await store.recvTransport.consume({
          id,
          producerId,
          kind,
          rtpParameters,
          appData: { ...appData, peerId }, // Trick.
        })
        consumer.on('transportclose', () => {
          console.log('#consumer-transportclose')
        })
        const {
          spatialLayers,
          temporalLayers,
        } = mediasoupClient.parseScalabilityMode(
          consumer.rtpParameters.encodings[0].scalabilityMode,
        )
        console.log('#我收到的串流資訊!', spatialLayers, temporalLayers)
        if (spatialLayers == 3) {
          store.track = consumer.track
          const stream = new MediaStream()
          stream.addTrack(consumer.track)
          document.getElementById('vod').srcObject = stream
          accept()
        }
      } else if (request.method === 'newDataConsumer') {
        const {
          peerId, // NOTE: Null if bot.
          dataProducerId,
          id,
          sctpStreamParameters,
          label,
          protocol,
          appData,
        } = request.data
        const dataConsumer = await store.recvTransport.consumeData({
          id,
          dataProducerId,
          sctpStreamParameters,
          label,
          protocol,
          appData: { ...appData, peerId }, // Trick.
        })
        dataConsumer.on('transportclose', () =>
          console.log('#dataConsumer_transportclose'),
        )
        dataConsumer.on('open', () => console.log('#dataConsumer_open'))
        dataConsumer.on('close', () => console.log('#dataConsumer_close'))
        dataConsumer.on('error', () => console.log('#dataConsumer_error'))
        dataConsumer.on('message', () => console.log('#dataConsumer_message'))
      }
    })
    _protoo.on('notification', notification => {
      console.log('#notification', notification)
      switch (notification.method) {
        case 'newPeer':
          store.users.push(notification.data)
          break
        case 'peerClosed':
          store.users =
            Lazy(store.users)
              .filter(user => {
                return user.id != notification.data.peerId
              })
              .toArray() || []
          break
      }
    })

    onMounted(async () => {
      await delay(1000)
      try {
        const _mediasoupDevice = new mediasoupClient.Device({
          handlerName: '',
        })
        const routerRtpCapabilities = await _protoo.request(
          'getRouterRtpCapabilities',
        )
        await _mediasoupDevice.load({ routerRtpCapabilities })
        const transportInfo = await _protoo.request('createWebRtcTransport', {
          forceTcp: false,
          producing: true,
          consuming: false,
          sctpCapabilities: _mediasoupDevice.sctpCapabilities,
        })
        const {
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
          sctpParameters,
        } = transportInfo

        const _sendTransport = _mediasoupDevice.createSendTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
          sctpParameters,
          iceServers: [],
          proprietaryConstraints: PC_PROPRIETARY_CONSTRAINTS,
        })

        _sendTransport.on(
          'connect',
          (
            { dtlsParameters },
            callback,
            errback, // eslint-disable-line no-shadow
          ) => {
            console.log('#connect')
            _protoo
              .request('connectWebRtcTransport', {
                transportId: _sendTransport.id,
                dtlsParameters,
              })
              .then(callback)
              .catch(errback)
          },
        )
        _sendTransport.on('produce', () => console.log('#produce'))
        _sendTransport.on('producedata', () => console.log('#producedata'))
        _sendTransport.on('connectionstatechange', () =>
          console.log('#connectionstatechange'),
        )

        {
          const transportInfo = await _protoo.request('createWebRtcTransport', {
            forceTcp: false,
            producing: false,
            consuming: true,
            sctpCapabilities: _mediasoupDevice.sctpCapabilities,
          })
          const {
            id,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
          } = transportInfo
          const _recvTransport = _mediasoupDevice.createRecvTransport({
            id,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
            iceServers: [],
          })
          store.recvTransport = _recvTransport
          _recvTransport.on(
            'connect',
            (
              { dtlsParameters },
              callback,
              errback, // eslint-disable-line no-shadow
            ) => {
              console.log('#connect 2')
              _protoo
                .request('connectWebRtcTransport', {
                  transportId: _recvTransport.id,
                  dtlsParameters,
                })
                .then(callback)
                .catch(errback)

              // const enableMic = async () => {
              //   const stream = await navigator.mediaDevices.getUserMedia({
              //     video: true,
              //   })
              //   const track = stream.getVideoTracks()[0].clone()
              //   await _sendTransport.produce({ track })
              // }
              // enableMic()
            },
          )
        }

        const { peers } = await _protoo.request('join', {
          displayName: store.name,
          device: {},
          rtpCapabilities: _mediasoupDevice.rtpCapabilities,
          sctpCapabilities: _mediasoupDevice.sctpCapabilities,
        })
        console.log('#peers', peers)
        store.users = peers
      } catch (e) {
        console.error('#error', e)
      }
    })

    return {
      PEER_ID,
      store,
    }
  },
}

function delay(_time = 0) {
  return new Promise(resolve => {
    setTimeout(resolve, _time)
  })
}
</script>
<style lang="postcss" scoped></style>
