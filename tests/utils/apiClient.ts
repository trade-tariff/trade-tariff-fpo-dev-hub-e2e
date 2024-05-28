import { expect } from '@playwright/test'

export class ApiClient {
  private static readonly URL = process.env.API_URL ?? 'https://search.dev.trade-tariff.service.gov.uk/fpo-code-search'
  private readonly apiKey: string | null
  private status: number | null
  private json: any

  constructor (apiKey: string | null) {
    this.apiKey = apiKey
    this.status = null
    this.json = null
  }

  async doClassification (description: string, expectFailure: boolean = false): Promise<void> {
    const res = await this.handleResponse(this.createPostRequestOptions(description), expectFailure)

    this.status = res?.status ?? null
    this.json = await res?.json()
  }

  assertSuccessful (): void {
    expect(this.status).toBe(200)
  }

  assertUnsuccessful (): void {
    expect(this.status).not.toBe(200)
  }

  async handleResponse (
    requestOptions: RequestInit,
    expectFailure: boolean,
    retries: number = 10,
    sleepForMillis: number = 100
  ): Promise<Response | null> {
    let currentRetry = 0
    let res: Response | null = null

    for (let i = 0; i < retries; i++) {
      res = await fetch(ApiClient.URL, requestOptions)

      if (expectFailure) {
        console.log(`Expecting failure, got ${res.status}`)
        if (res.status !== 200) break
      } else {
        console.log(`Expecting success, got ${res.status}`)
        if (res.status === 200) break
      }

      currentRetry++

      await new Promise(resolve => setTimeout(resolve, sleepForMillis ** currentRetry))
    }

    return res
  }

  async assertClassification (expectedClassification: string): Promise<void> {
    const data = this.json ?? {}
    const results = data?.results ?? []
    const matchedResult = results.find((result: any) => result.code === expectedClassification)
    expect(matchedResult).toBeDefined()
  }

  private createPostRequestOptions (description: string): RequestInit {
    const body: BodyInit = JSON.stringify({ description })
    return {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey ?? '',
        'Content-Type': 'application/json'
      },
      body
    }
  }

  private printForNodeCli (responseOptions: any, url: any): void {
    console.log(`
const url = '${url}';
const requestOptions = ${JSON.stringify(responseOptions, null, 2)};
const res = await fetch(url, requestOptions);
console.log('Response status:', res.status);
console.log('Response body:', await res.json());
`)
  }
}
