const { EmbedBuilder } = require('discord.js');

module.exports = { 
    name: "messageReactionAdd",
    async execute(reaction, user, client) {
        if (user.bot) return;

        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.emoji.name !== '🔥') return;

            const embed = new EmbedBuilder()
            .setDescription(`Want access to exclusive picks, expert insights, and real-time alerts? \nUpgrade to VIP today - everything you need is in #upgrade-to-vip.`)
            .setColor(`Blue`)

            await user.send({embeds:[embed]});
        } catch (error) {
            console.error("Error handling reaction:", error);
        }
    }
};
