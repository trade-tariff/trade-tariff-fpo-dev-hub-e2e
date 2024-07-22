# trade-tariff-fpo-dev-hub-e2e

> Remember to install pre-commit hooks before making any changes to the repository.

Playwright suite used to validate the end to end functionality of the FPO dev hub

The hub service allows users to authenticate using their SCP logins and create
credentials in Api Gateway in order to make requests to the
Commodity Code Identification Tool (the protected resource).

The general flow that we're validating in this suite is as follows:

```mermaid
sequenceDiagram
    participant User
    participant Playwright
    participant SCP as SCP (SSO Provider)
    participant Hub Frontend
    participant Cognito as Cognito (M2M)
    participant Hub Backend
    participant DynamoDB
    participant APIGateway as API Gateway

    User->>Playwright: Initiate test
    Playwright->>SCP: Authenticate with OpenID
    SCP-->>Playwright: Token
    Playwright->>Hub Frontend: Access with token
    Hub Frontend->>Cognito: Authenticate with client credentials
    Cognito-->>Hub Frontend: Access token
    Hub Frontend->>Playwright: Display dashboard
    Playwright->>Hub Frontend: Create API Gateway API Key credentials
    Hub Frontend->>APIGateway: Generate API Key
    APIGateway-->>Hub Frontend: API Key
    Hub Frontend-->>Playwright: Return API Key
    Playwright->>APIGateway: Perform Commodity Code Identification with API Key
    APIGateway->>Hub Backend: Forward request with API Key
    Hub Backend->>DynamoDB: Query data
    DynamoDB-->>Hub Backend: Return data
    Hub Backend-->>APIGateway: Return data
    APIGateway-->>Playwright: Return data
    Playwright-->>User: Test results
```

The hub frontend is accessible on the following URLs:

- [development][development-hub]
- [staging][staging-hub]
- [production][production-hub]

Implementation details for the frontend and backend can be reviewed, here:

- [frontend][frontend-github]
- [backend][backend-github]

[development-hub]: https://hub.dev.trade-tariff.service.gov.uk/
[staging-hub]: https://hub.staging.trade-tariff.service.gov.uk/
[production-hub]: https://hub.trade-tariff.service.gov.uk/
[frontend-github]: https://github.com/trade-tariff/trade-tariff-dev-hub-frontend
[backend-github]: https://github.com/trade-tariff/trade-tariff-dev-hub-backend

### Running tests locally
For the first time, run this command to install Chromium 
```
npx playwright install
```
### Running tests
```
npx playwright test
```
### Running tests in debug mode
```
npx playwright test --headed --debug
```