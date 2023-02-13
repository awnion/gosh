import { useOutletContext, useParams } from 'react-router-dom'
import { classNames, ESmvEventType, shortString, useSmvEvent, useUser } from 'react-gosh'
import { TDaoLayoutOutletContext } from '../DaoLayout'
import Loader from '../../components/Loader'
import { EventProgressBar, EventStatusBadge } from '../../components/Event'
import CopyClipboard from '../../components/CopyClipboard'
import moment from 'moment'
import {
    EventVotingForm,
    MemberAddEvent,
    MemberRemoveEvent,
    MemberAllowanceEvent,
    DaoMintReserveEvent,
    DaoUpgradeEvent,
    DaoMintDisableEvent,
    RepoBranchEvent,
    RepoPullRequestEvent,
    RepoCreateEvent,
    RepoTaskCreateEvent,
    RepoTaskConfirmEvent,
    RepoTaskDeleteEvent,
} from './components'
import ReactTooltip from 'react-tooltip'
import { Button } from '../../components/Form'
import { toast } from 'react-toastify'
import ToastError from '../../components/Error/ToastError'
import { Form, Formik } from 'formik'

const EventPage = () => {
    const { eventAddr } = useParams()
    const { user } = useUser()
    const { dao } = useOutletContext<TDaoLayoutOutletContext>()
    const { event, isFetching } = useSmvEvent(dao.adapter, eventAddr!)

    const getDurationDelta = () => {
        const ms = moment(event?.time.finish).diff(moment())
        const delta = moment.duration(ms)
        return `${delta.days()}d ${delta.hours()}h ${delta.minutes()}m`
    }

    const onReviewApprove = async () => {
        try {
            await dao.adapter.addEventReview(event!.address)
            toast.success('Review accepted. Event details will be updated soon')
        } catch (e: any) {
            console.error(e.message)
            toast.error(<ToastError error={e} />)
        }
    }

    if (isFetching && !event) {
        return <Loader>Loading event...</Loader>
    }
    if (!isFetching && !event) {
        return <div>Event not found</div>
    }
    if (!event) {
        return null
    }
    return (
        <div>
            <div>
                <h3 className="text-xl font-medium mb-4">{event.type.name}</h3>
                <div
                    className={classNames(
                        'flex flex-wrap items-center gap-x-5 gap-y-2',
                        'text-sm text-gray-7c8db5',
                    )}
                >
                    <EventStatusBadge status={event.status} />
                    <div className="grow text-gray-7c8db5 text-sm">
                        {!event.reviewers.length ? (
                            <>
                                Created {new Date(event.time.start).toLocaleDateString()}
                                <span className="mx-1">-</span>
                                Executed{' '}
                                {new Date(event.time.finish).toLocaleDateString()}
                            </>
                        ) : (
                            'Review required'
                        )}
                    </div>
                    <div>
                        <CopyClipboard
                            label={
                                <span data-tip="Event address">
                                    {shortString(eventAddr!)}
                                </span>
                            }
                            componentProps={{
                                text: eventAddr!,
                            }}
                        />
                    </div>
                </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 justify-between">
                <div className="basis-8/12">
                    {event.data.comment && (
                        <div className="border border-gray-e6edff rounded-xl px-4 py-5 mb-6">
                            <h3 className="mb-3 text-xl font-medium">
                                Event description
                            </h3>
                            <div className="text-sm">{event.data.comment}</div>
                        </div>
                    )}

                    <div className="border border-gray-e6edff rounded-xl px-4 py-5">
                        <h3 className="mb-3 text-xl font-medium">Event details</h3>
                        {event.type.kind === ESmvEventType.DAO_MEMBER_ADD && (
                            <MemberAddEvent version={dao.details.version} event={event} />
                        )}
                        {event.type.kind === ESmvEventType.DAO_MEMBER_DELETE && (
                            <MemberRemoveEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.DAO_ALLOWANCE_CHANGE && (
                            <MemberAllowanceEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.DAO_TOKEN_MINT && (
                            <DaoMintReserveEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.DAO_UPGRADE && (
                            <DaoUpgradeEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.DAO_TOKEN_MINT_DISABLE && (
                            <DaoMintDisableEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.REPO_CREATE && (
                            <RepoCreateEvent event={event} />
                        )}
                        {(event.type.kind === ESmvEventType.BRANCH_LOCK ||
                            event.type.kind === ESmvEventType.BRANCH_UNLOCK) && (
                            <RepoBranchEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.PULL_REQUEST && (
                            <RepoPullRequestEvent
                                daoName={dao.details.name}
                                event={event}
                            />
                        )}
                        {event.type.kind === ESmvEventType.TASK_CREATE && (
                            <RepoTaskCreateEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.TASK_CONFIRM && (
                            <RepoTaskConfirmEvent event={event} />
                        )}
                        {event.type.kind === ESmvEventType.TASK_DELETE && (
                            <RepoTaskDeleteEvent event={event} />
                        )}
                    </div>
                </div>

                <div className="grow">
                    <div className="border border-gray-e6edff rounded-xl p-5">
                        <EventProgressBar votes={event.votes} />
                        <div className="mt-5 text-sm text-gray-7c8db5 text-center">
                            {!event.reviewers.length ? (
                                <>{getDurationDelta()} to end</>
                            ) : (
                                'Review required'
                            )}
                        </div>
                    </div>

                    {!event.status.completed &&
                        dao.details.isAuthMember &&
                        !event.reviewers.length && (
                            <div className="mt-5 border border-gray-e6edff rounded-xl p-5">
                                <h3 className="mb-4 text-xl font-medium">Your vote</h3>
                                <EventVotingForm dao={dao} event={event} />
                            </div>
                        )}

                    {!!event.reviewers.length && (
                        <div className="mt-5 border border-gray-e6edff rounded-xl p-5">
                            <h3 className="mb-4 text-xl font-medium">Event review</h3>
                            <div className="text-sm">
                                Review required from:
                                <ul>
                                    {event.reviewers.map((username, index) => (
                                        <li key={index}>{username}</li>
                                    ))}
                                </ul>
                            </div>

                            {event.reviewers.indexOf(user.username || '') >= 0 && (
                                <div className="mt-3">
                                    <Formik initialValues={{}} onSubmit={onReviewApprove}>
                                        {({ isSubmitting }) => (
                                            <Form>
                                                <Button
                                                    type="submit"
                                                    isLoading={isSubmitting}
                                                    disabled={isSubmitting}
                                                >
                                                    Approve
                                                </Button>
                                            </Form>
                                        )}
                                    </Formik>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <ReactTooltip clickable />
            </div>
        </div>
    )
}

export default EventPage
