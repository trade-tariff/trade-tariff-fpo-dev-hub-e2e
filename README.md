# Trade Tariff Dev Hub end-to-end tests

This Playwright suite checks the
[Trade Tariff Dev Hub](https://github.com/trade-tariff/trade-tariff-dev-hub).
It covers passwordless sign-in, organisation access and API credential journeys.
Sign-in uses the Identity service and a test email inbox in S3, not the former
SCP sign-in flow.

## Set up locally

Use Node.js and Yarn with the versions supported by [package.json](package.json)
and the [CI workflows](.github/workflows/):

```sh
yarn install --frozen-lockfile
yarn playwright install chromium
```

Playwright may also need operating-system browser libraries. Follow its platform
requirements if Chromium cannot start.

## Configure a test environment

[playwright.config.ts](playwright.config.ts) loads `.env.development` by default.
Set `PLAYWRIGHT_ENV` to select another environment file. It then loads `.env`;
existing environment variables are not overwritten by dotenv.

Configure these values in ignored local files or through the authorised secret
mechanism:

- `URL`: the Dev Hub URL to test.
- `EMAIL_ADDRESS`: the dedicated test sign-in address.
- `INBOUND_BUCKET`: the S3 bucket containing the test inbox.
- `LOCK_KEY`: the S3 key used to coordinate access to that inbox.
- `WAF_BYPASS_TOKEN`: the approved test token if the target requires it.

The suite also needs authorised AWS credentials for the test inbox and lock.
Keep credentials and test data out of Git. Do not copy production secrets into
a local environment file.

## Check changes

Checks that do not run the browser journeys:

```sh
yarn lint
yarn typecheck
```

After confirming approval for the target development environment:

```sh
yarn test-development
```

For an interactive browser and debugger:

```sh
yarn playwright test --headed --debug
```

The suite uses one worker because sign-in shares an inbox and distributed lock.
Do not increase concurrency without reviewing those boundaries. These are live
integration tests: they can create, revoke and delete API credentials. A test
run is not an offline check.

Traces and HTML reports can contain sign-in details or credentials. Keep them
private and review them before sharing. Do not run against production without
explicit approval.

## Find your way around

- [tests/](tests/): browser journeys and helpers.
- [playwright.config.ts](playwright.config.ts): environment loading and browser settings.
- [package.json](package.json): test, lint and type-check commands.
- [GitHub Actions](.github/workflows/): environment-specific execution and secrets.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the fork workflow and private security
reporting.

## Licence

The code and associated documentation use the [MIT licence](LICENCE.md), with
Crown copyright (HM Revenue & Customs). Dependencies retain their own licences.
