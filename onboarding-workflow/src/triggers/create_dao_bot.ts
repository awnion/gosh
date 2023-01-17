import { Mutex } from 'https://deno.land/x/semaphore@v1.1.2/mod.ts'
import { getOrCreateDaoBot } from '../db/dao_bot.ts'
import { getDb } from '../db/db.ts'
import { getGithubsWithoutDao } from '../db/github.ts'

const mutex = new Mutex()

getDb()
    .channel('githubs:without_dao')
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'github' },
        (payload) => {
            console.log('githubs updated', payload)
            updateGithubs()
        },
    )
    .subscribe()

updateGithubs()

async function updateGithubs() {
    const release = await mutex.acquire()
    try {
        const githubs = await getGithubsWithoutDao()

        for (const github of githubs) {
            const internal_url = github.gosh_url.split(`//`)[1]
            const [_root, dao_name] = internal_url.split(`/`)

            try {
                const dao_bot = await getOrCreateDaoBot(dao_name)

                await getDb()
                    .from('github')
                    .update({ dao_bot: dao_bot.id })
                    .eq('id', github.id)
            } catch (err) {
                console.error('Skip github', dao_name, 'due to', err)
            }
        }
    } catch (err) {
        console.error('No githubs', err)
    }
    release()
}