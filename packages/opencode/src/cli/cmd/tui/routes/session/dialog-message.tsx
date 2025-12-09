import { createMemo } from "solid-js"
import { useSync } from "@tui/context/sync"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useSDK } from "@tui/context/sdk"
import { useRoute } from "@tui/context/route"
import { Clipboard } from "@tui/util/clipboard"
import type { PromptInfo } from "@tui/component/prompt/history"

export function DialogMessage(props: {
  messageID: string
  sessionID: string
  setPrompt?: (prompt: PromptInfo) => void
}) {
  const sync = useSync()
  const sdk = useSDK()
  const message = createMemo(() => sync.data.message[props.sessionID]?.find((x) => x.id === props.messageID))
  const route = useRoute()

  // Load custom message actions from config
  const customActions = createMemo(() => {
    const messageActions = (sync.data.config as any).messageActions ?? []
    return messageActions.map((action: any) => ({
      title: action.label,
      value: `message.action.${action.label}`,
      description: action.description,
      category: "Message Actions",
      onSelect: async (dialog: any) => {
        // Execute message action via direct API call (SDK v2 doesn't have this endpoint yet)
        try {
          const url = `${sdk.baseUrl}/session/${props.sessionID}/message/${props.messageID}/action`

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: action.label }),
          })

          console.log("Response status:", response.status)

          if (!response.ok) {
            const text = await response.text()
            console.error("Message action failed:", text)
          } else {
            const result = await response.json()
            console.log("Message action result:", result)
          }
        } catch (error) {
          console.error("Message action error:", error)
        }
        dialog.clear()
      },
    }))
  })

  return (
    <DialogSelect
      title="Message Actions"
      options={[
        {
          title: "Revert",
          value: "session.revert",
          description: "undo messages and file changes",
          onSelect: (dialog) => {
            const msg = message()
            if (!msg) return

            sdk.client.session.revert({
              path: { sessionID: props.sessionID },
              body: { messageID: msg.id },
            })

            if (props.setPrompt) {
              const parts = sync.data.part[msg.id]
              const promptInfo = parts.reduce(
                (agg, part) => {
                  if (part.type === "text") {
                    if (!part.synthetic) agg.input += part.text
                  }
                  if (part.type === "file") agg.parts.push(part)
                  return agg
                },
                { input: "", parts: [] as PromptInfo["parts"] },
              )
              props.setPrompt(promptInfo)
            }

            dialog.clear()
          },
        },
        {
          title: "Copy",
          value: "message.copy",
          description: "copy message text to clipboard",
          onSelect: async (dialog) => {
            const msg = message()
            if (!msg) return

            const parts = sync.data.part[msg.id]
            const text = parts.reduce((agg, part) => {
              if (part.type === "text" && !part.synthetic) {
                agg += part.text
              }
              return agg
            }, "")

            await Clipboard.copy(text)
            dialog.clear()
          },
        },
        {
          title: "Fork",
          value: "session.fork",
          description: "create a new session",
          onSelect: async (dialog) => {
            const result = await sdk.client.session.fork({
              path: { sessionID: props.sessionID },
              body: { messageID: props.messageID },
            })
            route.navigate({
              sessionID: result.data!.id,
              type: "session",
            })
            dialog.clear()
          },
        },
        {
          title: "Copy Fork Command",
          value: "session.copy-fork-command",
          description: "to fork in a new terminal",
          onSelect: async (dialog) => {
            const command = `opencode session fork --session ${props.sessionID} --message ${props.messageID}`
            await Clipboard.copy(command)
            dialog.clear()
          },
        },
        ...customActions(),
      ]}
    />
  )
}
