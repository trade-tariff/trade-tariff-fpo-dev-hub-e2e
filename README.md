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
    participant Frontend
    participant Cognito as Cognito (M2M)
    participant Backend
    participant DynamoDB
    participant APIGateway as API Gateway

    User->>Playwright: Initiate test
    Playwright->>SCP: Authenticate with OpenID
    SCP-->>Playwright: Token
    Playwright->>Frontend: Access with token
    Frontend->>Cognito: Authenticate with client credentials
    Cognito-->>Frontend: Access token
    Frontend->>Playwright: Display dashboard
    Playwright->>Frontend: Create API Gateway API Key credentials
    Frontend->>APIGateway: Generate API Key
    APIGateway-->>Frontend: API Key
    Frontend-->>Playwright: Return API Key
    Playwright->>APIGateway: Perform Commodity Code Identification with API Key
    APIGateway->>Backend: Forward request with API Key
    Backend->>DynamoDB: Query data
    DynamoDB-->>Backend: Return data
    Backend-->>APIGateway: Return data
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
