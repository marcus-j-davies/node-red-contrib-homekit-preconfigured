'use strict'

const HapNodeJS = require('hap-nodejs')
const uuid = HapNodeJS.uuid
const Service = HapNodeJS.Service
const Characteristic = HapNodeJS.Characteristic
const StreamController = HapNodeJS.StreamController
const crypto = require('crypto')
const ip = require('ip')
const spawn = require('child_process').spawn

module.exports = {
    Camera: Camera,
}



function Camera(config)
{
    this.config = config;
    this.services = []
    this.streamControllers = []

    this.pendingSessions = {}
    this.ongoingSessions = {}

    const videoResolutions = []


    this.maxWidth = config.maxWidth
    this.maxHeight = config.maxHeight
    this.fps = config.maxFPS;
    this.maxBitrate = 300
    this.packetsize = 1316
    this.additionalCommandline = "-tune zerolatency"
    this.vcodec = "libx264"
    this.mapvideo = "0:0"
    

    const maxFPS = this.fps > 30 ? 30 : this.fps

    if (this.maxWidth >= 320) {
        if (this.maxHeight >= 240) {
            videoResolutions.push([320, 240, maxFPS])
            if (maxFPS > 15) {
                videoResolutions.push([320, 240, 15])
            }
        }

        if (this.maxHeight >= 180) {
            videoResolutions.push([320, 180, maxFPS])
            if (maxFPS > 15) {
                videoResolutions.push([320, 180, 15])
            }
        }
    }

    if (this.maxWidth >= 480) {
        if (this.maxHeight >= 360) {
            videoResolutions.push([480, 360, maxFPS])
        }

        if (this.maxHeight >= 270) {
            videoResolutions.push([480, 270, maxFPS])
        }
    }

    if (this.maxWidth >= 640) {
        if (this.maxHeight >= 480) {
            videoResolutions.push([640, 480, maxFPS])
        }

        if (this.maxHeight >= 360) {
            videoResolutions.push([640, 360, maxFPS])
        }
    }

    if (this.maxWidth >= 1280) {
        if (this.maxHeight >= 960) {
            videoResolutions.push([1280, 960, maxFPS])
        }

        if (this.maxHeight >= 720) {
            videoResolutions.push([1280, 720, maxFPS])
        }
    }

    if (this.maxWidth >= 1920) {
        if (this.maxHeight >= 1080) {
            videoResolutions.push([1920, 1080, maxFPS])
        }
    }
    

    

  
    
    const options = {
        proxy: false, 
        srtp: true,
        video: {
            resolutions: videoResolutions,
            codec: {
                profiles: [0, 1, 2],
                levels: [0, 1, 2]
            },
        },
        audio: {
            codecs: [
                {
                    type: 'OPUS',
                    samplerate: 24
                },
                {
                    type: 'AAC-eld', 
                    samplerate: 16
                },
            ],
        },
    }
    
    const controlService = new Service.CameraControl('', '');
    this.services.push(controlService);
    
    for (let i = 0; i < config.maxStreams; i++)
     {
        const streamController = new StreamController(i, options, this)
         this.services.push(streamController.service)
         this.streamControllers.push(streamController)
     }
  
}

Camera.prototype.handleCloseConnection = function (connectionID) {

    this.streamControllers.forEach(function (controller)
    {
        controller.handleCloseConnection(connectionID)
    })
}

Camera.prototype.handleStreamRequest = function(request) {

    const sessionID = request['sessionID']
    const requestType = request['type']
    if (sessionID)
    {
        const sessionIdentifier = uuid.unparse(sessionID)

        if (requestType === 'start')
        {
            const sessionInfo = this.pendingSessions[sessionIdentifier]
            if (sessionInfo)
            {
                let width = this.maxWidth
                let height = this.maxHeight
                let fps = this.fps
                let vbitrate = this.maxBitrate
                const vcodec = this.vcodec
                const packetsize = this.packetsize
                const additionalCommandline = this.additionalCommandline
                const mapvideo = this.mapvideo
     

                const videoInfo = request['video']
                if (videoInfo)
                {
                    width = videoInfo['width']
                    height = videoInfo['height']

                    const expectedFPS = videoInfo['fps']
                    if (expectedFPS < fps)
                    {
                        fps = expectedFPS
                    }
                    if (videoInfo['max_bit_rate'] < vbitrate)
                    {
                        vbitrate = videoInfo['max_bit_rate']
                    }
                }

               

                let targetAddress = sessionInfo['address']
                let targetVideoPort = sessionInfo['video_port']
                let videoKey = sessionInfo['video_srtp']
                let videoSsrc = sessionInfo['video_ssrc']
                
    
             

                let fcmd = this.config.sourceStream

                const ffmpegInputArgs = ' -map ' + mapvideo + ' -vcodec ' + vcodec + ' -pix_fmt yuv420p -r ' + fps + ' -f rawvideo' + ' ' + additionalCommandline + ' -vf scale=' + width + ':' + height + ' -b:v ' + vbitrate + 'k' + ' -bufsize ' + vbitrate + 'k' + ' -maxrate ' + vbitrate + 'k' + ' -payload_type 99'
                const ffmpegStreamArgs = ' -ssrc ' + videoSsrc + ' -f rtp' + ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' + ' -srtp_out_params ' + videoKey.toString('base64') + ' srtp://' + targetAddress + ':' + targetVideoPort + '?rtcpport=' + targetVideoPort + '&localrtcpport=' + targetVideoPort + '&pkt_size=' + packetsize

                fcmd += ffmpegInputArgs
                fcmd += ffmpegStreamArgs

                const ffmpeg = spawn("ffmpeg", fcmd.split(' '), { env: process.env, })

                const self = this

                ffmpeg.on('close', code =>
                {
                    if (code == null || code === 0 || code === 255)
                    {
                       // Stopped
                    }
                    else
                    {
                        for (let i = 0; i < self.streamControllers.length; i++)
                        {
                            const controller = self.streamControllers[i]
                            if (controller.sessionIdentifier === sessionID)
                            {
                                controller.forceStop()
                            }
                        }
                    }
                })
                this.ongoingSessions[sessionIdentifier] = ffmpeg
            }

            delete this.pendingSessions[sessionIdentifier]

        }
        else if (requestType === 'stop')
        {
            const ffmpegProcess = this.ongoingSessions[sessionIdentifier]

            if (ffmpegProcess)
            {
                ffmpegProcess.kill('SIGTERM')
            }

            delete this.ongoingSessions[sessionIdentifier]
        }
        else if (requestType === 'reconfigure')
        {
            //?
        }
    }



}

Camera.prototype.prepareStream = function(request, callback) {
    
     const sessionInfo = {}

     const sessionID = request['sessionID']
    sessionInfo['address'] = request['targetAddress']

    const response = {}

    const videoInfo = request['video']
    if (videoInfo)
    {
        const targetPort = videoInfo['port']
        const srtp_key = videoInfo['srtp_key']
        const srtp_salt = videoInfo['srtp_salt']

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4)
        ssrcSource[0] = 0
        const ssrc = ssrcSource.readInt32BE(0, true)

        response['video'] = {
            port: targetPort,
            ssrc: ssrc,
            srtp_key: srtp_key,
            srtp_salt: srtp_salt,
        }

        sessionInfo['video_port'] = targetPort
        sessionInfo['video_srtp'] = Buffer.concat([srtp_key, srtp_salt])
        sessionInfo['video_ssrc'] = ssrc
    }

    const audioInfo = request['audio']
    if (audioInfo) {
        const targetPort = audioInfo['port']
        const srtp_key = audioInfo['srtp_key']
        const srtp_salt = audioInfo['srtp_salt']

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4)
        ssrcSource[0] = 0
        const ssrc = ssrcSource.readInt32BE(0, true)

        response['audio'] = {
            port: targetPort,
            ssrc: ssrc,
            srtp_key: srtp_key,
            srtp_salt: srtp_salt,
        }

        sessionInfo['audio_port'] = targetPort
        sessionInfo['audio_srtp'] = Buffer.concat([srtp_key, srtp_salt])
        sessionInfo['audio_ssrc'] = ssrc
    }

    const currentAddress = ip.address()
    const addressResp = {
        address: currentAddress,
    }

    if (ip.isV4Format(currentAddress)) {
        addressResp['type'] = 'v4'
    } else {
        addressResp['type'] = 'v6'
    }

    response['address'] = addressResp
    this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo

    callback(response)
}

Camera.prototype.handleSnapshotRequest = function(request, callback) {
    
    const resolution = request.width + 'x' + request.height

    
    const ffmpeg = spawn("ffmpeg", (this.config.sourceStream + ' -t 1 -s ' + resolution + ' -f image2 -').split(' '), { env: process.env })
       let imageBuffer = Buffer.alloc(0);
    
      ffmpeg.stdout.on('data', function(data)
     {
        imageBuffer = Buffer.concat([imageBuffer, data])
     })
    
     ffmpeg.on('close', function(code)
     {
        callback(undefined, imageBuffer)
     })
    
}
