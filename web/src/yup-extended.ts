import { GoshAdapterFactory } from 'react-gosh'
import { IGoshAdapter } from 'react-gosh/dist/gosh/interfaces'
import * as yup from 'yup'
import { AnyObject, Maybe } from 'yup/lib/types'

yup.addMethod<yup.StringSchema>(yup.string, 'username', function () {
    return this.test('test-username', 'Invalid username', function (value) {
        const { path, createError } = this
        if (!value) {
            return true
        }

        const gosh = GoshAdapterFactory.createLatest()
        const { valid, reason } = gosh.isValidUsername(value)
        return valid ? true : createError({ path, message: reason })
    })
})

yup.addMethod<yup.StringSchema>(yup.string, 'daoname', function () {
    return this.test('test-daoname', 'Invalid DAO name', function (value) {
        const { path, createError } = this
        if (!value) {
            return true
        }

        const gosh = GoshAdapterFactory.createLatest()
        const { valid, reason } = gosh.isValidDaoName(value)
        return valid ? true : createError({ path, message: reason })
    })
})

yup.addMethod<yup.StringSchema>(yup.string, 'reponame', function (gosh: IGoshAdapter) {
    return this.test('test-daoname', 'Invalid repository name', function (value) {
        if (!value) {
            return true
        }

        const { path, createError } = this
        const { valid, reason } = gosh.isValidRepoName(value)
        return valid ? true : createError({ path, message: reason })
    })
})

declare module 'yup' {
    interface StringSchema<
        TType extends Maybe<string> = string | undefined,
        TContext extends AnyObject = AnyObject,
        TOut extends TType = TType,
    > extends yup.BaseSchema<TType, TContext, TOut> {
        username(): StringSchema<TType, TContext>
        daoname(): StringSchema<TType, TContext>
        reponame(gosh: IGoshAdapter): StringSchema<TType, TContext>
    }
}

export default yup