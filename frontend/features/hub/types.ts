export interface HubSender {
  name: string | null
  avatar_url: string | null
  email: string | null
  linkedin_url: string | null
}

export interface ReplyPreview {
  content: string
  sender_name: string | null
}

export interface HubMessage {
  id: string
  sender_id: string
  content: string
  reply_to_id: string | null
  created_at: string
  sender: HubSender
  reply_preview: ReplyPreview | null
  image_url: string | null
  image_width: number | null
  image_height: number | null
  edited_at: string | null
  /** True while the message has not yet been confirmed by the server. */
  optimistic?: boolean
  /** True if the send failed and it should be shown as failed. */
  failed?: boolean
  /** True while an image is uploading, before the message itself is sent. */
  uploadingImage?: boolean
}

export interface PresenceMember {
  user_id: string
  name: string | null
  avatar_url: string | null
}
