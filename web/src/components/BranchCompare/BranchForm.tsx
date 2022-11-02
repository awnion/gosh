import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Form, Formik } from 'formik'
import { classNames, useBranches } from 'react-gosh'
import { TBranch } from 'react-gosh/dist/types/repo.types'
import * as Yup from 'yup'
import BranchSelect from '../BranchSelect'

type TBranchCompareFormProps = {
    className?: string
    onBuild(values: TBranchFormValues): Promise<void>
}

type TBranchFormValues = {
    src: TBranch
    dst: TBranch
}

const BranchCompareForm = (props: TBranchCompareFormProps) => {
    const { className, onBuild } = props
    const { branch, branches } = useBranches(undefined, 'main')

    return (
        <div className={classNames(className)}>
            <Formik
                initialValues={{
                    src: branch!,
                    dst: branch!,
                }}
                onSubmit={onBuild}
                validationSchema={Yup.object().shape({
                    src: Yup.object({ name: Yup.string().required('Field is required') }),
                    dst: Yup.object({ name: Yup.string().required('Field is required') }),
                })}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form className="flex items-center gap-x-4">
                        <BranchSelect
                            branch={values.src}
                            branches={branches}
                            onChange={(selected) => {
                                !!selected && setFieldValue('src', selected)
                            }}
                        />
                        <span>
                            <FontAwesomeIcon icon={faChevronRight} size="sm" />
                        </span>
                        <BranchSelect
                            branch={values.dst}
                            branches={branches}
                            onChange={(selected) => {
                                !!selected && setFieldValue('dst', selected)
                            }}
                        />
                        <button
                            type="submit"
                            className="btn btn--body px-3 !py-1.5 !text-sm"
                            disabled={isSubmitting}
                        >
                            Compare
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    )
}

export { BranchCompareForm }