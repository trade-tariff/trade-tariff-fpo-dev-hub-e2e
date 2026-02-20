import { expect } from '@playwright/test'

export interface Classifiable {
  description: string
  expectFailure?: boolean
}

interface HandleResponseOptions {
  requestOptions: RequestInit
  expectFailure: boolean
  retries?: number
  sleepForMillis?: number
}

/**
 * Client for the FPO code-search classification API. Used to verify that
 * a created API key works and that a revoked key is rejected.
 */
export class ApiClient {
  private static readonly URL = process.env.API_URL ?? 'https://search.dev.trade-tariff.service.gov.uk/fpo-code-search'

  /** Retries while API key propagation is delayed (e.g. after create/revoke). */
  private static readonly DEFAULT_RETRIES = 120
  private static readonly RETRY_SLEEP_MS = 1000

  private readonly apiKey: string | null
  private status: number | null
  private json: unknown

  constructor(apiKey: string | null) {
    this.apiKey = apiKey
    this.status = null
    this.json = null
  }

  async doClassification(opts: Classifiable): Promise<void> {
    const handleOpts: HandleResponseOptions = {
      requestOptions: this.createPostRequestOptions(opts.description),
      expectFailure: opts.expectFailure ?? false
    }

    const res = await this.handleResponse(handleOpts)

    this.status = res?.status ?? null
    this.json = await res?.json()
  }

  assertSuccessful(): void {
    expect(this.status).toBe(200)
  }

  assertUnsuccessful(): void {
    expect(this.status).not.toBe(200)
  }

  async handleResponse(opts: HandleResponseOptions): Promise<Response | null> {
    const startTime = Date.now()
    const retries = opts.retries ?? ApiClient.DEFAULT_RETRIES
    const sleepForMillis = opts.sleepForMillis ?? ApiClient.RETRY_SLEEP_MS

    let res: Response | null = null
    let success = false

    for (let attempt = 0; attempt < retries; attempt++) {
      res = await fetch(ApiClient.URL, opts.requestOptions)

      // When expectFailure, we succeed when status !== 200 (key revoked/invalid).
      if (opts.expectFailure) {
        if (res.status !== 200) {
          success = true
          break
        }
      } else {
        if (res.status === 200) {
          success = true
          break
        }
      }

      console.log(`Retrying ${attempt + 1} times...`)
      await new Promise(resolve => setTimeout(resolve, sleepForMillis))
    }

    const endTime = Date.now()
    const deltaSeconds = (endTime - startTime) / 1000

    if (success) {
      console.log(`Key ${opts.expectFailure ? 'inactive' : 'active'} in ${deltaSeconds} seconds`)
    } else {
      console.log(`Key failed to be ${opts.expectFailure ? 'inactive' : 'active'} in ${deltaSeconds} seconds`)
    }

    return res
  }

  assertClassification(expectedClassification: string): void {
    const data = this.json ?? {}
    const results = data?.results ?? []
    const matchedResult = results.find((result: unknown) => result.code === expectedClassification)
    expect(matchedResult).toBeDefined()
  }

  private createPostRequestOptions(description: string): RequestInit {
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
}
