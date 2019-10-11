module.exports = {
  description: 'accept pub/followbot invites',
  commands: {
    accept: {
      type: 'async',
      description:
        'accept an invite, connects to the pub, requests invite, then follows pub if successful',
      args: {
        invite: {
          type: 'InviteCode',
          description: 'the invite code to accept',
        },
      },
    },
  },
};
