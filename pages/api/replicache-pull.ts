import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function (req: NextApiRequest, res: NextApiResponse) {
  const pull = req.body

  try {
    // Need a Replicache type here
    const patch: { op: string; key?: string; value?: any }[] = []
    const { data: db } = await axios.get('http://localhost:3001/db')

    console.log('DB: ', JSON.stringify(db, null, 2))

    const cookieVersion = parseInt(pull.cookie ?? '0')

    if (pull.cookie === null) {
      patch.push({
        op: 'clear',
      })
    }

    const notes = db.notes
    const changedNotes = notes.filter((n: any) => n.version > cookieVersion)
    const changedNoteOps = changedNotes.map((n: any) => ({
      op: 'put',
      key: `note/${n.id}`,
      value: {
        text: n.text,
        id: n.id,
      },
    }))

    patch.push(...changedNoteOps)

    res.status(200).json({
      lastMutationID: db.lastMutationId.value,
      cookie: db.version.value,
      patch,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: { message: 'Something blew up' } })
  }
}
