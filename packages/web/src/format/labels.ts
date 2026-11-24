const CHANNELS: Readonly<Record<string, string>> = {
  clever: 'Clever',
  classlink: 'ClassLink',
  sftp: 'SFTP',
  oneroster: 'OneRoster',
  manual_upload: 'Manual upload',
  sso: 'Single sign-on',
  other: 'Other',
};

/** A channel as people say it: "clever" is "Clever", "manual_upload:Family Messaging LLC" is "Manual upload". */
export function channelLabel(channel: string): string {
  const kind = channel.split(':')[0] ?? channel;

  return CHANNELS[kind] ?? kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
