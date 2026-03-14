<!-- # Dot [<img src="https://img.shields.io/static/v1?label=invite%20to&message=Discord&color=informational&style=for-the-badge" alt="Invite to Discord" align="right" />](https://discord.com/api/oauth2/authorize?client_id=691882968809209917&permissions=275146467392&scope=bot) -->


A Discord bot to facilitate organising Mobile Legends tournaments online using [Challonge](https://challonge.com/).

Dot automates the tedious tasks of the sign-up process, email verification, and tracking match scores for tournament hosts.
This frees up hosts to focus on the overall flow of the tournament and any disputes instead of a lot of repetitive work.
It currently supports hosting Swiss tournaments of up to 256 participants (a limitation of Challonge's [standard tier](https://challonge.com/pricing)).

## Discord permissions

<!-- Please make sure you use an [invite link](https://discord.com/api/oauth2/authorize?client_id=691882968809209917&permissions=275146467392&scope=bot) that automatically grants the following permissions. -->

- Manage Roles: Dot creates a role to designate Tournament Organisers upon joining a server and will create and delete participant roles for each tournament.
- Send Messages
- Manage Messages: Dot automatically removes reactions from "reaction buttons" if participants are dropped via commands.
- Embed Links: Dot sends tournament information in the form of a Discord rich embed.
- Attach Files
- Read Message History

Privileged gateway intents required:

- Server members intent: Dot removes participants from tournaments if they leave the server.

## Usage

After Dot joins your server, you can ping it to confirm that it is working.
You can set permissions for Dot so it is allowed to access only specific channels and locked out of the rest.
If you do not want people to use Dot in a channel, deny Dot access to the channel.
However, if Dot does have access to a channel, make sure it has the full range of permissions listed above.

When Dot joins your server, it will automatically create an `DOT-TO` role to identify tournament hosts.
Give this role to anybody who needs to be able to control Dot to host tournament. Only users with the
role will be allowed to list all tournaments on the server and create new ones. For developers, the name
of the role can be changed by the `DOT_DEFAULT_TO_ROLE` environment variable. In the future, the name
and colour of this role will be configurable per server. For now, please do not delete the role,
rename the role, or create another role with the same name &mdash; Dot will lose track of the role and
recreate it, or worse, identify authorised hosts with the incorrect role.

The default prefix for all Dot commands is `dot!`. For developers, this can be changed by the `DOT_DEFAULT_PREFIX`
environment variable. In the future, this will also be configurable per server.

- [Commands for tournament hosts](docs/usage-organiser.md)
- [Commands for participants](docs/usage-participant.md)
- [Complete User Flows Guide](docs/USER_FLOWS.md) - Comprehensive flow documentation
- [Visual Flow Diagrams](docs/FLOW_DIAGRAMS.md) - ASCII flowcharts for all processes
- [CLI utilities](docs/usage-cli.md) - Command-line administrative tools

## Desktop App

A desktop application is available for easy deployment without requiring Node.js or Docker setup.

### Building the Desktop App

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for both
npm run build:all
```

Installers are created in `dist/installers/`.

### Using the Desktop App

1. Run the installer and launch MLBB Tournament Bot
2. Enter your Discord bot token and Challonge credentials
3. Click "Save & Start Bot"
4. Access the web interface via the "🌐 Web Interface" button

See [docs/DESKTOP_APP_SETUP.md](docs/DESKTOP_APP_SETUP.md) for detailed setup instructions.

## Development

Dot is written in TypeScript. It targets Node.js 20+ and can be run with or without Docker.
It uses Discord.js to talk to Discord and PostgreSQL for persistence.


1. Install Docker with Docker Compose, or install PostgreSQL.
1. Start Postgres. You can start up just the Postgres container with `docker-compose up -d postgres`.
1. Create a `.env` file with the required credentials and configuration. Examples below:
    - In Docker:

        ```
        POSTGRES_HOST_PORT=127.0.0.1:5432
        POSTGRES_USER=
        POSTGRES_PASSWORD=
        POSTGRES_DB=
        DISCORD_TOKEN=
        CHALLONGE_USERNAME=
        CHALLONGE_TOKEN=
        DOT_DEFAULT_PREFIX=dot!
        DOT_DEFAULT_TO_ROLE=DOT-TO
        ```

    - Outside Docker:

        ```
        NODE_ENV=development
        DEBUG=dot:*
        POSTGRESQL_URL=postgresql://USER:PASSWORD@localhost:5432/DBNAME
        DISCORD_TOKEN=
        CHALLONGE_USERNAME=
        CHALLONGE_TOKEN=
        DOT_DEFAULT_PREFIX=dot!
        DOT_DEFAULT_TO_ROLE=DOT-TO
        ```

1. Start Dot.
    - In Docker: `docker-compose up --build` and wait for the image to build.
    - Outside Docker: `yarn && yarn build && node --enable-source-maps dist`.

Please use Australian English spellings.

## Licence

Copyright © 2020&ndash;2025 Luna Brand, Kevin Lu.
See [COPYING](COPYING) for more details.

```
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
