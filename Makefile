SHELL=bash

.PHONY: run migration-run migration-revert migration-show migration-generate migration-create

run:
	bun start

migration-run:
	bun run migration:run

migration-revert:
	bun run migration:revert

migration-show:
	bun run migration:show

migration-generate:
	@if [ -z "$(name)" ]; then echo "Usage: make migration-generate name=DescriptiveName"; exit 1; fi
	bunx typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate src/database/migrations/$(name)

migration-create:
	@if [ -z "$(name)" ]; then echo "Usage: make migration-create name=DescriptiveName"; exit 1; fi
	bunx typeorm-ts-node-commonjs -d src/database/data-source.ts migration:create src/database/migrations/$(name)

