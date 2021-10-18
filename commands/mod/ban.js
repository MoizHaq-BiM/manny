import { Command } from 'discord-akairo'
import { DateTime } from 'luxon'
import config from '../../config'
import Case from '../../models/cases'
import _ from '../../utilities/Util'

class BanCommand extends Command {
  constructor () {
    super('ban', {
      aliases: ['ban'],
      category: 'Moderator',
      description: {
        name: 'Ban User',
        short: 'Ban a user from the server.',
        long: 'Ban a user from the server. This action is recorded in the mod log.',
        syntax: '!ban user reason',
        args: {
          user: 'The user you want to ban. Can be a name, mention, or ID.',
          reason: 'The reason this user is being banned.'
        }
      },
      channel: 'guild',
      clientPermissions: ['BAN_MEMBERS', 'EMBED_LINKS', 'SEND_MESSAGES'],
      userPermissions: ['BAN_MEMBERS']
    })
  }

  * args () {
    const user = yield {
      type: 'user'
    }

    const reason = yield {
      match: 'rest',
      default: '`No reason given`'
    }

    return { user, reason }
  }

  async exec (message, { user, reason }) {
    try {
      if (!user) {
        return message.channel.send('User not found. Please try again.')
      }

      await message.delete()

      if (user.id === message.author.id) {
        return message.util.send(`${_.prefix('warning')} Why would you ban yourself?`)
      }

      if (user.id === this.client.user.id) {
        return message.util.send(`${_.prefix('warning')} Nice try, human.`)
      }

      // If user is a guild member, make sure we have permission to ban them
      if (message.guild.members.cache.some(member => member.user.id === user.id)) {
        const member = await message.guild.members.fetch(user)

        if (member.roles.highest.position >= message.member.roles.highest.position) {
          return message.util.send('You don\'t have permission to ban this user.')
        }

        if (!member.bannable) {
          return message.util.send('I am unable to ban this user.')
        }
      }

      // Send receipt (This must be done first here because we can't send a DM after they're banned)
      const receipt = this.client.util.embed()
        .setAuthor(message.guild.name, message.guild.iconURL())
        .setTitle(`${_.prefix('ban')} You were banned from the server`)
        .addField('Reason', reason)
        .addField('Appeals', `If you would like to appeal this decision, [fill out this form](${config.meta.links.appeals}) and we will get back to you as soon as possible.`)

      try {
        await user.send({ embed: receipt })
      } catch (e) {
        await message.channel.send(':warning: Failed to send a DM. User will not be notified.')
      }

      // Take action
      await message.guild.members.ban(user, { days: 1, reason: reason })

      // Record case
      const record = await Case.create({
        action: 'ban',
        user: user.tag,
        userID: user.id,
        moderator: message.author.tag,
        moderatorID: message.author.id,
        reason: reason,
        timestamp: DateTime.local()
      })

      // Send mod log
      const logChannel = this.client.channels.cache.get(config.channels.logs.modLog)
      const logEntry = this.client.util.embed()
        .setColor(_.color('red'))
        .setAuthor(user.tag)
        .setThumbnail(user.displayAvatarURL())
        .setTitle(`${_.prefix('ban')} Member banned`)
        .setDescription(`by ${message.author.tag}`)
        .addField('Reason', reason)
        .setFooter(`#${record.id}`)
        .setTimestamp()

      await logChannel.send({ embed: logEntry })
      return message.util.send(`${_.prefix('ban')} **${user.tag}** was banned.`)
    } catch (e) {
      await message.channel.send('Something went wrong. Check the logs for details.')
      return this.client.log.error(e)
    }
  }
}

export default BanCommand
