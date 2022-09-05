import { TonClient, ClientConfig } from '@eversdk/core'
import { createDockerDesktopClient } from '@docker/extension-api-client'
import { GoshRoot } from './classes'

class AppConfig {
    private static _goshclient?: ClientConfig
    private static _goshroot?: string
    static _goshversion?: string
    static ipfs?: string
    static dockerclient?: any

    static setup(params: {
        goshclient: ClientConfig
        goshroot: string
        goshversion: string
        ipfs: string
        isDockerExt: boolean
    }) {
        const { goshclient, goshroot, goshversion, ipfs, isDockerExt } = params
        AppConfig._goshclient = goshclient
        AppConfig._goshroot = goshroot
        AppConfig._goshversion = goshversion
        AppConfig.ipfs = ipfs
        AppConfig.dockerclient = isDockerExt ? createDockerDesktopClient() : null
    }

    static get goshclient() {
        if (!AppConfig._goshclient) throw Error('Gosh client config is undefined')
        return new TonClient(AppConfig._goshclient)
    }

    static get goshroot() {
        if (!AppConfig._goshroot) throw Error('Gosh root is undefined')
        return new GoshRoot(AppConfig.goshclient, AppConfig._goshroot)
    }

    static get goshversion() {
        if (!AppConfig._goshversion) throw Error('Gosh version is undefined')
        return AppConfig._goshversion
    }
}

export { AppConfig }