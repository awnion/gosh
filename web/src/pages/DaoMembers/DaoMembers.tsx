import Spinner from '../../components/Spinner'
import { useDaoMemberList, useDaoMemberDelete, useProfile } from 'react-gosh'
import DaoMemberListItem from './MemberListItem'
import { useOutletContext } from 'react-router-dom'
import { TDaoLayoutOutletContext } from '../DaoLayout'
import DaoMemberForm from './MemberForm'
import { toast } from 'react-toastify'

const DaoMembersPage = () => {
    const profile = useProfile()
    const { dao } = useOutletContext<TDaoLayoutOutletContext>()
    const { items, isFetching, search, setSearch, loadItemDetails } = useDaoMemberList(0)
    const daoMemberDeleteHook = useDaoMemberDelete()

    const onMemberDelete = async (pubkey?: string) => {
        if (!pubkey) return
        if (window.confirm('Delete member?')) {
            try {
                await daoMemberDeleteHook.deleteMember(pubkey)
            } catch (e: any) {
                console.error(e.message)
                toast.error(e.message)
            }
        }
    }

    return (
        <>
            <div className="input">
                <input
                    className="element !py-1.5"
                    type="search"
                    placeholder="Search member by pubkey..."
                    autoComplete="off"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="mt-8 mb-2">
                {isFetching && (
                    <div className="text-gray-606060">
                        <Spinner className="mr-3" />
                        Loading members...
                    </div>
                )}

                <div className="divide-y divide-gray-c4c4c4">
                    {items.map((item, index) => {
                        loadItemDetails(item)
                        return (
                            <DaoMemberListItem
                                key={index}
                                item={item}
                                daoOwnerPubkey={dao.details.owner}
                                isDaoOwner={profile?.address === dao.details.owner}
                                isFetching={
                                    item.pubkey
                                        ? daoMemberDeleteHook.isFetching(item.pubkey)
                                        : false
                                }
                                onDelete={onMemberDelete}
                            />
                        )
                    })}
                </div>
            </div>

            {profile?.address === dao.details.owner && (
                <div className="mt-6">
                    <DaoMemberForm />
                </div>
            )}
        </>
    )
}

export default DaoMembersPage
