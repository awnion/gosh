import { Field, Form, Formik } from 'formik'
import { TextField, TextareaField } from '../../../components/Formik'
import { useNavigate } from 'react-router-dom'
import Spinner from '../../../components/Spinner'
import { toast } from 'react-toastify'
import { GoshError, useDaoCreate } from 'react-gosh'
import DaoCreateProgress from './DaoCreateProgress'
import ToastError from '../../../components/Error/ToastError'
import yup from '../../../yup-extended'

type TFormValues = {
    name: string
    members: string
}

const DaoCreateForm_1_0_0 = () => {
    const navigate = useNavigate()
    const daocreate = useDaoCreate()

    const onDaoCreate = async (values: TFormValues) => {
        try {
            if (!daocreate.create) {
                throw new GoshError('Create DAO is not supported')
            }

            const { name, members } = values
            await daocreate.create(name, { members: members.split('\n') })
            navigate('/a/orgs')
        } catch (e: any) {
            console.error(e.message)
            toast.error(<ToastError error={e} />)
        }
    }

    return (
        <div className="container container--full mt-12 mb-5">
            <div className="bordered-block max-w-lg px-7 py-8 mx-auto">
                <h1 className="font-semibold text-2xl text-center mb-8">
                    Create new organization
                </h1>

                <Formik
                    initialValues={{
                        name: '',
                        members: '',
                    }}
                    onSubmit={onDaoCreate}
                    validationSchema={yup.object().shape({
                        name: yup.string().daoname().required('Name is required'),
                    })}
                    enableReinitialize
                >
                    {({ isSubmitting, setFieldValue }) => (
                        <Form>
                            <div>
                                <Field
                                    label="Name"
                                    name="name"
                                    component={TextField}
                                    inputProps={{
                                        placeholder: 'New organization name',
                                        autoComplete: 'off',
                                        disabled: isSubmitting,
                                        onChange: (e: any) =>
                                            setFieldValue(
                                                'name',
                                                e.target.value.toLowerCase(),
                                            ),
                                    }}
                                />
                            </div>

                            <div className="mt-6">
                                <Field
                                    label="Add members (optional)"
                                    name="members"
                                    component={TextareaField}
                                    inputProps={{
                                        placeholder: 'Username(s)',
                                        autoComplete: 'off',
                                        disabled: isSubmitting,
                                        rows: 5,
                                        onChange: (e: any) =>
                                            setFieldValue(
                                                'members',
                                                e.target.value.toLowerCase(),
                                            ),
                                    }}
                                    help="Put each username from new line"
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn--body px-3 py-3 w-full mt-8"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Spinner className="mr-3" size={'lg'} />}
                                Create organization
                            </button>
                        </Form>
                    )}
                </Formik>

                <DaoCreateProgress progress={daocreate.progress} className={'mt-4'} />
            </div>
        </div>
    )
}

export default DaoCreateForm_1_0_0