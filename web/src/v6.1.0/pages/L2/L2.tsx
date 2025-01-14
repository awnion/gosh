import { AnimatePresence, motion } from 'framer-motion'
import { useL2Transfer } from '../../hooks/l2.hooks'
import { CompleteStep, TransferStep, RouteStep, Breadcrumbs } from './components'
import { fromBigint, shortString, roundNumber, getDurationDelta } from '../../../utils'
import { useEffect, useState } from 'react'
import Alert from '../../../components/Alert'
import CopyClipboard from '../../../components/CopyClipboard'
import { useErrorBoundary, withErrorBoundary } from 'react-error-boundary'
import { EL2Network } from '../../types/l2.types'
import { Button } from '../../../components/Form'
import moment from 'moment'

const motionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25 },
}

const getPayoutTime = () => {
    const hours = [0, 3, 6, 9, 12, 15, 18, 21]
    const moments = hours.map((h) => moment.utc({ hour: h, minute: 0, second: 0 }))
    moments.push(moment.utc({ day: moment.utc().date() + 1, hour: 0, second: 0 }))

    const now = moment()
    const diffs = moments.map((m) => m.diff(now, 'seconds'))
    const index = diffs.findIndex((diff) => diff > 0)
    return moments[index]
}

const L2PageInner = () => {
    const { showBoundary } = useErrorBoundary()
    const { web3, gosh, comissions, networks, summary, step, reset, error, connectWeb3 } =
        useL2Transfer({
            initialize: true,
        })
    const [payout, setPayout] = useState<any>(getPayoutTime())
    const route = `${summary.from.network}:${summary.to.network}`

    const getNetworkBalance = (network: string) => {
        const floatstr = fromBigint(networks[network].balance, networks[network].decimals)
        return roundNumber(floatstr, 5)
    }

    useEffect(() => {
        if (error) {
            showBoundary(error)
        }
    }, [error])

    useEffect(() => {
        const interval = setInterval(() => setPayout(getPayoutTime()), 1000)

        return () => {
            clearInterval(interval)
            reset()
        }
    }, [])

    return (
        <div className="flex flex-wrap xl:flex-nowrap items-start justify-center gap-16">
            <div className="grow">
                <h1 className="text-3xl font-medium mb-4">Cross-chain transfer</h1>
                <Alert variant="warning" className="mb-6">
                    <h3 className="font-medium">
                        GOSH Ethereum L2 <span className="text-red-ff3b30">Alpha</span>{' '}
                        Testing
                    </h3>
                    <div>
                        The contract has not been formally verified yet. Please do not
                        send a lot!
                    </div>
                </Alert>
                <div className="my-10">
                    <Breadcrumbs />
                </div>

                <AnimatePresence mode="wait">
                    {step === 'route' && (
                        <motion.div key="route" {...motionProps}>
                            <RouteStep />
                        </motion.div>
                    )}
                    {step === 'transfer' && (
                        <motion.div key="transfer" {...motionProps}>
                            <TransferStep />
                        </motion.div>
                    )}
                    {step === 'complete' && (
                        <motion.div key="complete" {...motionProps}>
                            <CompleteStep />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="basis-full xl:basis-4/12 shrink-0">
                <div className="border border-gray-e6edff rounded-xl p-5">
                    <h3 className="text-xl font-medium">Accounts</h3>

                    <div className="mt-6 flex flex-col gap-y-5">
                        <div className="flex items-center justify-between gap-x-6">
                            <div className="grow flex flex-nowrap items-center gap-x-3">
                                <img
                                    src={networks[EL2Network.ETH].iconpath}
                                    className="w-8"
                                    alt="Blockchain"
                                />
                                <div>
                                    {networks[EL2Network.ETH].label}
                                    {web3.instance && (
                                        <CopyClipboard
                                            className="text-xs text-gray-7c8db5"
                                            label={shortString(web3.address)}
                                            componentProps={{ text: web3.address }}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="font-medium">
                                {web3.instance ? (
                                    <>
                                        {getNetworkBalance(EL2Network.ETH)}{' '}
                                        <span className="text-gray-7c8db5 font-light text-sm">
                                            {networks[EL2Network.ETH].token}
                                        </span>
                                    </>
                                ) : (
                                    <Button type="button" size="sm" onClick={connectWeb3}>
                                        Connect
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-x-6">
                            <div className="grow flex flex-nowrap items-center gap-x-3">
                                <img
                                    src={networks[EL2Network.GOSH].iconpath}
                                    className="w-8"
                                    alt="Blockchain"
                                />
                                <div>
                                    {networks[EL2Network.GOSH].label}
                                    <CopyClipboard
                                        className="text-xs text-gray-7c8db5"
                                        label={shortString(gosh.address)}
                                        componentProps={{ text: gosh.address }}
                                    />
                                </div>
                            </div>
                            <div className="font-medium">
                                {getNetworkBalance(EL2Network.GOSH)}{' '}
                                <span className="text-gray-7c8db5 font-light text-sm">
                                    {networks[EL2Network.GOSH].token}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 border border-gray-e6edff rounded-xl p-5">
                    <h3 className="text-xl font-medium">Summary</h3>

                    <div className="mt-6">
                        <h4 className="text-gray-7c8db5 text-sm mb-1">Send</h4>
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                            <div className="grow flex flex-nowrap items-center gap-x-3">
                                <img
                                    src={networks[summary.from.network].iconpath}
                                    className="w-8"
                                    alt="Blockchain"
                                />
                                <div>
                                    {networks[summary.from.network].label}
                                    <CopyClipboard
                                        className="text-xs text-gray-7c8db5"
                                        label={shortString(summary.from.wallet)}
                                        componentProps={{ text: summary.from.wallet }}
                                    />
                                </div>
                            </div>
                            <div className="text-sm font-medium whitespace-nowrap">
                                {summary.from.amount.toLocaleString()}{' '}
                                <span className="text-gray-7c8db5 font-light text-sm">
                                    {networks[summary.from.network].token}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <h4 className="text-gray-7c8db5 text-sm mb-1">Receive</h4>
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                            <div className="grow flex flex-nowrap items-center gap-x-3">
                                <img
                                    src={networks[summary.to.network].iconpath}
                                    className="w-8"
                                    alt="Blockchain"
                                />
                                <div>
                                    {networks[summary.to.network].label}
                                    <CopyClipboard
                                        className="text-xs text-gray-7c8db5"
                                        label={shortString(summary.to.wallet)}
                                        componentProps={{ text: summary.to.wallet }}
                                    />
                                </div>
                            </div>
                            <div className="text-sm font-medium whitespace-nowrap">
                                {summary.to.amount.toLocaleString()}{' '}
                                <span className="text-gray-7c8db5 font-light text-sm">
                                    {networks[summary.to.network].token}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-t-gray-e6edff">
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                            <div className="grow text-sm">Estimate comission</div>
                            <div className="text-sm font-medium whitespace-nowrap">
                                {fromBigint(
                                    comissions[route],
                                    networks[summary.to.network].decimals,
                                )}{' '}
                                <span className="text-gray-7c8db5 font-light text-sm">
                                    {networks[summary.to.network].token}
                                </span>
                            </div>
                        </div>

                        {route === `${EL2Network.GOSH}:${EL2Network.ETH}` && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                                <div className="grow text-sm">Next payout</div>
                                <div className="text-sm font-medium font-mono whitespace-nowrap">
                                    {getDurationDelta(payout, '[h:h] [m:m] [s:s]')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const L2Page = withErrorBoundary(L2PageInner, {
    fallbackRender: ({ error }) => (
        <Alert variant="danger">
            <h3 className="font-medium">Ethereum L2 error</h3>
            <div>{error.message}</div>
        </Alert>
    ),
})

export default L2Page
