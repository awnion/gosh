import { AppConfig } from './appconfig'
import { toast } from 'react-toastify'
import { createAvatar } from '@dicebear/core'
import { identicon } from '@dicebear/collection'
import { supabase } from './supabase'
import classNames from 'classnames'

export const getClipboardData = async (event?: any): Promise<string | null> => {
    if (event?.clipboardData && event.clipboardData.getData) {
        return event.clipboardData.getData('text/plain')
    }

    const win = window as any
    if (win.clipboardData && win.clipboardData.getData) {
        return win.clipboardData.getData('Text')
    }

    if (navigator.clipboard.readText !== undefined) {
        return await navigator.clipboard.readText()
    }

    return null
}

export const onExternalLinkClick = (e: any, url: string) => {
    if (!AppConfig.dockerclient) {
        return
    }
    e.preventDefault()
    AppConfig.dockerclient.host.openExternal(url)
}

export const getIdenticonAvatar = (options: any) => {
    return createAvatar(identicon, {
        radius: 8,
        scale: 60,
        backgroundColor: ['fafafd'],
        ...options,
    })
}

export const getUsernameByEmail = async (email: string): Promise<string[] | null> => {
    const { data, error } = await supabase.client
        .from('users')
        .select('gosh_username')
        .eq('email', email)
        .order('created_at', { ascending: true })
    if (error) {
        console.warn('Error query user by email', error)
        return null
    }
    return data.length ? data.map(({ gosh_username }) => gosh_username) : null
}

/**
 * Toast shortcuts
 */
export const ToastOptionsShortcuts = {
    Default: {
        position: toast.POSITION.TOP_RIGHT,
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        pauseOnFocusLoss: false,
        draggable: true,
        closeButton: true,
        progress: undefined,
        isLoading: false,
        delay: 100,
    },
    Message: {
        position: toast.POSITION.TOP_CENTER,
        autoClose: 1500,
        pauseOnFocusLoss: false,
        pauseOnHover: false,
        closeButton: false,
        hideProgressBar: true,
    },
    CopyMessage: {
        position: toast.POSITION.TOP_CENTER,
        autoClose: 1500,
        pauseOnFocusLoss: false,
        pauseOnHover: false,
        closeButton: false,
        hideProgressBar: true,
        style: { width: '50%' },
        className: 'mx-auto',
    },
}

/**
 * Select2 (react-select)
 */
export const Select2ClassNames = {
    control: (props: any) => {
        return classNames(
            '!rounded-lg !border-gray-e6edff !text-sm !bg-white !shadow-none',
            props.isDisabled ? '!text-gray-7c8db5' : null,
        )
    },
    valueContainer: () => '!px-4 !py-1',
    placeholder: () => '!text-black/40',
    menuList: () => '!py-0',
    noOptionsMessage: () => '!text-sm',
    option: () => '!text-sm',
}
