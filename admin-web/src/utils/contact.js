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
    "friends",
    "friend_list",
    "user_list",
    "rows",
  ];
  for (const key of candidateKeys) {
    if (Array.isArray(obj[key])) {
      return obj[key];
    }
  }

  return [];
}

function pickField(row, keys) {
  for (const key of keys) {
    const value = row[key];
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
      "user_id",
      "external_userid",
      "wxid",
      "id",
      "username",
    ]);
    const name = pickField(row, [
      "remark",
      "nickname",
      "name",
      "display_name",
      "username",
    ]);
    const avatar = pickField(row, ["avatar", "head_img", "headimgurl"]);

    return {
      key: id || `contact_${index}`,
      id,
      name: name || "未命名好友",
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
