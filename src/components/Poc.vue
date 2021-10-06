<template>
  <div class="poc">Poc</div>
</template>
<script>
import protooClient from 'protoo-client'
import * as mediasoupClient from 'mediasoup-client'
import { onMounted } from 'vue'
const SERVICE = 'wss://dev.webrtc.anchorgo.io:4443/?roomId=caintest&peerId=123'
const PC_PROPRIETARY_CONSTRAINTS = {
  optional: [{ googDscp: true }],
}
export default {
  name: 'Poc',
  setup() {
    const protooTransport = new protooClient.WebSocketTransport(SERVICE)
    const _protoo = new protooClient.Peer(protooTransport)
    _protoo.on('open', () => console.log('#open'))
    _protoo.on('failed', () => console.log('#failed'))
    _protoo.on('disconnected', () => console.log('#disconnected'))
    _protoo.on('close', () => console.log('#close'))
    _protoo.on('request', (request, accept, reject) => {
      console.log('#request', request.method, accept, reject)
    })
    _protoo.on('notification', () => console.log('#notification'))

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
            },
          )
        }

        const { peers } = await _protoo.request('join', {
          displayName: 'Cain',
          device: {},
          rtpCapabilities: _mediasoupDevice.rtpCapabilities,
          sctpCapabilities: _mediasoupDevice.sctpCapabilities,
        })
        console.log('#peers', peers)
      } catch (e) {
        console.error('#error', e)
      }
    })
  },
}

function delay(_time = 0) {
  return new Promise(resolve => {
    setTimeout(resolve, _time)
  })
}
</script>
<style lang="postcss" scoped></style>
