
Currently, logger has dependency from pino.
I would like to have kore lib dependency free
Ideally for simple logging I would like to use pretty logging and inject pinno as DI if required any other transports

Logger implementation:
src/utils/logger.ts

Logging guide developed for current logging implementation:
tmp/logging_guide.md

