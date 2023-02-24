import { classNames } from 'react-gosh'
import emptylogo from '../../assets/images/emptylogo.svg'

type TExternalListItemProps = {
    className?: string
    item: { name: string; repos: string[] }
}

const ExternalListItem = (props: TExternalListItemProps) => {
    const { className, item } = props

    return (
        <div
            className={classNames(
                'border border-gray-e6edff rounded-xl flex flex-nowrap p-5',
                'hover:bg-gray-e6edff/20',
                className,
            )}
        >
            <div className="overflow-hidden rounded-xl">
                <img src={emptylogo} alt="" className="w-14 h-14 md:w-20 md:h-20" />
            </div>
            <div className="grow pl-4">
                <div className="text-xl font-medium leading-5">{item.name}</div>
                <div className="text-xs text-gray-53596d mt-4">
                    {item.repos.join(', ')}
                </div>
            </div>
        </div>
    )
}

export default ExternalListItem
