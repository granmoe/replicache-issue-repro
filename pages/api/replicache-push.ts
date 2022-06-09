import type { NextApiRequest, NextApiResponse } from 'next'
import Pusher from 'pusher'
import axios from 'axios'

const {
  PUSHER_APP_ID: appId = '',
  NEXT_PUBLIC_PUSHER_APP_KEY: key = '',
  PUSHER_SECRET: secret = '',
  NEXT_PUBLIC_PUSHER_CLUSTER: cluster = '',
} = process.env

for (const pusherEnvVar of [appId, key, secret, cluster]) {
  if (!pusherEnvVar) {
    throw new Error('Pusher env var missing')
  }
}

const pusher = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
})

export default async function (req: NextApiRequest, res: NextApiResponse) {
  const push = req.body

  const { data: db } = await axios.get('http://localhost:3001/db')

  try {
    const nextVersion = db.version.value + 1
    await axios.post('http://localhost:3001/version', { value: nextVersion })
    let lastMutationId = db.lastMutationId.value

    for (const mutation of push.mutations) {
      const expectedMutationId = lastMutationId + 1

      if (mutation.id < expectedMutationId) {
        console.log(
          `Mutation ${mutation.id} has already been processed - skipping`,
        )
        continue
      }
      if (mutation.id > expectedMutationId) {
        console.warn(`Mutation ${mutation.id} is from the future - aborting`)
        break
      }

      console.log('Processing mutation:', JSON.stringify(mutation))

      // Create an artificial delay
      await new Promise((r) => setTimeout(r, 3000))

      switch (mutation.name) {
        case 'createNote':
          await createNote(mutation.args, nextVersion)
          break
        default:
          throw new Error(`Unknown mutation: ${mutation.name}`)
      }

      lastMutationId += 1
    }

    console.log(
      `Setting client ${push.clientID} last_mutation_id to ${lastMutationId}`,
    )

    await axios.post('http://localhost:3001/lastMutationId', {
      value: lastMutationId,
    })

    await sendPoke()

    // Taken from the docs. Does Replicache require this exact response? Or maybe just HTTP status and doesn't care about body?
    res.send('{}')
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: { message: 'Error during replicache push' } })
  }
}

async function createNote(
  { id, text }: { id: string; text: string },
  version: number,
) {
  await axios.post('http://localhost:3001/notes', {
    id,
    text,
    version,
  })
}

async function sendPoke() {
  await pusher.trigger('replicache', 'poke', null)
}
