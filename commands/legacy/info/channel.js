import { Command } from 'discord-akairo'
import _ from '../../../utilities/Util'

class ChannelInfoCommand extends Command {
  constructor () {
    super('channel', {
      aliases: ['channel'],
      category: 'Info',
      description: {
        name: 'Channel Info',
        short: 'Get information about a channel.',
        syntax: '!channel channel',
        args: {
          channel: 'The channel you want to learn about. Can be a name, mention, or ID.'
        }
      },
      channel: 'guild',
      clientPermissions: ['EMBED_LINKS', 'SEND_MESSAGES']
    })
  }

  * args () {
    const channel = yield {
      type: 'channel',
      match: 'rest',
      default: message => message.channel,
      prompt: {
        retry: 'Channel not found. Please enter a channel name, mention, or ID.',
        optional: true
      }
    }

    return { channel }
  }

  exec (message, { channel }) {
    const embed = this.client.util.embed()
      .addField('Type', _.capitalize(channel.type), true)
      .addField('ID', channel.id, true)

    if (channel.parent) {
      embed.addField('Category', _.capitalize(channel.parent.name))
    }

    switch (channel.type) {
      case 'text':
        embed
          .setTitle(`**#${channel.name}**`)
          .addField('Topic', channel.topic ? channel.topic : 'None')
          .addField('Created', _.prettyDate(channel.createdAt))

        if (channel.lastMessage) {
          embed.addField('Last Activity', _.prettyDate(channel.lastMessage.editedAt || channel.lastMessage.createdAt))
        }
        break
      case 'voice':
        embed
          .setTitle(`**${channel.name}**`)
          .addField('Bitrate', `${channel.bitrate / 1000}kbps`)
          .addField('Users', channel.userLimit > 0 ? `${channel.members.size} / ${channel.userLimit}` : channel.members.size)
          .addField('Created', _.prettyDate(channel.createdAt))
        break
      default:
        embed
          .setTitle(`**${channel.name}**`)
          .addField('Created', _.prettyDate(channel.createdAt))
        break
    }

    return message.util.send({ embed })
  }
}

export default ChannelInfoCommand
