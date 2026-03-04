function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value;
  const candidateKeys = [
    "list",
    "items",
    "contacts",
    "contact_list",
    "contactList",
    "friends",
    "friend_list",
    "friendList",
    "user_list",
    "userList",
    "rows",
    "members",
    "member_list",
    "external_contact_list",
    "external_contacts",
  ];
  for (const key of candidateKeys) {
    if (Array.isArray(obj[key])) {
      return obj[key];
    }
  }

  return [];
}

function getByPath(target, path) {
  if (!target || typeof target !== "object") {
    return undefined;
  }
  const segments = String(path).split(".");
  let current = target;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function pickField(row, keys) {
  for (const key of keys) {
    const value = key.includes(".") ? getByPath(row, key) : row[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
}

export function normalizeContacts(rawData) {
  const rows = toArray(rawData);
  return rows.map((row, index) => {
    const id = pickField(row, [
      "conversation_id",
      "conversationId",
      "user_id",
      "userid",
      "external_user_id",
      "external_userid",
      "wxid",
      "id",
      "uid",
      "profile.user_id",
      "username",
    ]);
    const nickname = pickField(row, [
      "remark",
      "nickname",
      "nick_name",
      "wx_nickname",
      "name",
      "display_name",
      "contact_name",
      "alias",
      "profile.nickname",
      "profile.name",
      "username",
    ]);
    const avatar = pickField(row, [
      "avatar",
      "avatar_url",
      "avatarUrl",
      "head_img",
      "headimgurl",
      "head_image",
      "small_avatar",
      "thumb_url",
      "icon",
      "profile.avatar",
      "profile.head_img",
      "profile.headimgurl",
    ]);
    const displayName = nickname || "未命名好友";

    return {
      key: id || `contact_${index}`,
      id,
      nickname: displayName,
      name: displayName,
      avatar,
      raw: row,
    };
  });
}

export function inferConversationId(contact) {
  if (!contact) {
    return "";
  }
  const raw = contact.raw || {};
  if (raw.conversation_id) {
    return String(raw.conversation_id);
  }
  if (contact.id.startsWith("S:") || contact.id.startsWith("R:")) {
    return contact.id;
  }
  if (contact.id.startsWith("788") || contact.id.startsWith("168")) {
    return `S:${contact.id}`;
  }
  if (contact.id.startsWith("10")) {
    return `R:${contact.id}`;
  }
  return contact.id;
}
