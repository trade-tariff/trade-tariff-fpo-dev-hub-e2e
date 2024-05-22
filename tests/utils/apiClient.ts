import { expect } from '@playwright/test'

export class ApiClient {
  private static readonly URL = process.env.API_URL ?? 'https://search.dev.trade-tariff.service.gov.uk/fpo-code-search'
  private readonly apiKey: string | null
  private response: Response | null

  constructor (apiKey: string | null) {
    this.apiKey = apiKey
    this.response = null
  }

  async doClassification (description: string): Promise<Response> {
    const response = await fetch(this.getRequest(description))

    this.response = response

    return response
  }

  async assertSuccessful (): Promise<void> {
    expect(this?.response?.status).toBe(200)
  }

  async assertUnsuccessful (): Promise<void> {
    expect(this?.response?.status ?? 400).not.toBe(200)
  }

  async assertClassification (expectedClassification: string): Promise<void> {
    const data = await this.response?.json()
    const matchedResult = data.results.find((result: any) => result.code === expectedClassification)
    expect(matchedResult).toBeDefined()
  }

  private getRequest (description: string): Request {
    return new Request(ApiClient.URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    })
  }
}
