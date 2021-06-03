import { Command } from 'discord-akairo'
import { DateTime } from 'luxon'
import config from '../../../config'
import Case from '../../../models/cases'
import Mute from '../../../models/mutes'
import Strike from '../../../models/strikes'
import _ from '../../../utilities/Util'

class PardonCommand extends Command {
  constructor () {
    super('pardon', {
      aliases: ['pardon'],
      category: 'Moderator',
      description: {
        name: 'Pardon',
        short: 'Remove a strike from a user.',
        long: 'Remove a strike from a user. This action is recorded in the mod log.',
        syntax: '!pardon case reason',
        args: {
          case: 'The case number for the strike you want to remove.',
          reason: 'The reason this strike is being removed.'
        }
      },
      channel: 'guild',
      clientPermissions: ['EMBED_LINKS', 'SEND_MESSAGES'],
      userPermissions: ['BAN_MEMBERS']
    })
  }

  * args () {
    const infraction = yield {
      type: 'infraction',
      prompt: {
        start: 'What\'s the case number for the strike you want to remove?',
        retry: 'Case not found. Please enter the case number found at the bottom of the log entry.'
      }
    }

    const reason = yield {
      match: 'rest',
      default: '`No reason given`'
    }

    return { infraction, reason }
  }

  async exec (message, { infraction, reason }) {
    try {
      await message.delete()

      // Record case
      const record = await Case.create({
        action: 'pardon',
        user: infraction.user,
        userID: infraction.userID,
        moderator: message.author.tag,
        moderatorID: message.author.id,
        reason: reason,
        timestamp: DateTime.local()
      })

      // Remove strike from schedule
      await Strike.destroy({
        where: { id: infraction.id }
      })

      await Case.update({ active: false }, {
        where: { id: infraction.id }
      })

      const strikeCount = await Case.count({
        where: {
          action: 'strike',
          userID: infraction.userID,
          active: true
        }
      })

      // If member is muted, unmute and remove mute from schedule
      const member = await message.guild.member(record.userID)

      if (member.roles.cache.some(role => role.name === 'Muted')) {
        const muteRole = await message.guild.roles.fetch(config.roles.muted)
        await member.roles.remove(muteRole)

        await Mute.destroy({
          where: { id: member.id }
        })
      }

      // Send mod log
      const logChannel = this.client.channels.cache.get(config.channels.logs.modLog)
      const logEntry = this.client.util.embed()
        .setColor(_.color('orange'))
        .setAuthor(member.user.tag)
        .setThumbnail(member.user.displayAvatarURL())
        .setTitle(`${_.prefix('undo')} Strike removed`)
        .setDescription(`by ${message.author.tag}`)
        .addField('Reason', reason)
        .setFooter(`#${record.id}`)
        .setTimestamp()

      await logChannel.send({ embed: logEntry })

      // Send receipt
      const receipt = this.client.util.embed()
        .setColor(_.color('orange'))
        .setAuthor(message.guild.name, message.guild.iconURL())
        .setTitle(`${_.prefix('undo')} One of your strikes was removed`)
        .setDescription(strikeCount === 0 ? 'You have no active strikes.' : `You have ${strikeCount} active strikes remaining.`)
        .addField('Reason', reason)
        .setFooter(`#${record.id}`)
        .setTimestamp()

      await member.send({ embed: receipt })
      return message.util.send(`${_.prefix('undo')} **${member.user.tag}** lost a strike.`)
    } catch (e) {
      await message.channel.send('Something went wrong. Check the logs for details.')
      return this.client.log.error(e)
    }
  }
}

export default PardonCommand
