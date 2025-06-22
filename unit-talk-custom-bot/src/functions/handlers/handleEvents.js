const fs = require(`fs`);
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const { connection } = require("mongoose");

module.exports = (client) => {
  client.handleEvents = async () => {
    const eventFolders = fs.readdirSync(`${config.directory}/events`);
    for (const folder of eventFolders) {
      const eventFiles = fs
        .readdirSync(`${config.directory}/events/${folder}`)
        .filter((file) => file.endsWith(`.js`));
      switch (folder) {
        case "client":
          for (const file of eventFiles) {
            const event = require(`${config.directory}/events/${folder}/${file}`);
            if (event.once)
              client.once(event.name, (...args) =>
                event.execute(...args, client)
              );
            else
            
              client.on(event.name, (...args) =>
                event.execute(...args, client)
              );
          }
          break;

        case "mongo":
          for (const file of eventFiles) {
            const event = require(`${config.directory}/events/${folder}/${file}`);
            if (event.once)
              connection.once(event.name, (...args) =>
                event.execute(...args, client)
              );
            else
              connection.on(event.name, (...args) =>
                event.execute(...args, client)
              );
          }
          break;

        default:
          break;
      }
    }
  };
};