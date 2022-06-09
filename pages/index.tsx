import Head from 'next/head'
import { nanoid } from 'nanoid'
import { Replicache, WriteTransaction } from 'replicache'
import { useSubscribe } from 'replicache-react'
import { useEffect, useState } from 'react'
import Pusher from 'pusher-js'

const replicacheMutators = {
  createNote(tx: WriteTransaction, { id, text }: { id: string; text: string }) {
    tx.put(`note/${id}`, {
      text,
    })
  },
}

type ReplicacheMutators = typeof replicacheMutators

export default function Home() {
  const [replicache, setReplicache] = useState<Replicache<ReplicacheMutators>>()

  useEffect(() => {
    const replicache = new Replicache({
      name: 'fake-user-id',
      licenseKey: process.env.NEXT_PUBLIC_REPLICACHE_LICENSE_KEY || '',
      pushURL: '/api/replicache-push',
      pullURL: '/api/replicache-pull',
      mutators: replicacheMutators,
    })
    setReplicache(replicache)

    listenForPokes(replicache)
  }, [])

  return (
    <div>
      <Head>
        <title>Replicache Issue</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>{replicache && <Notes replicache={replicache} />}</main>
    </div>
  )
}

const Notes = ({
  replicache,
}: {
  replicache: Replicache<ReplicacheMutators>
}) => {
  const notes = useSubscribe(
    replicache,
    async (tx) => {
      const notes = await tx.scan({ prefix: 'note/' }).entries().toArray()
      return notes
    },
    [],
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          replicache.mutate.createNote({ id: nanoid(), text: 'placeholder' })
        }}
      >
        Create note
      </button>
      <pre>
        <code>{JSON.stringify(notes, null, 2)}</code>
      </pre>
    </>
  )
}

Pusher.logToConsole = true
function listenForPokes(replicache: any) {
  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY || '', {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  })
  const channel = pusher.subscribe('replicache')

  channel.bind('poke', () => {
    console.log('got poked')
    replicache.pull()
  })
}
