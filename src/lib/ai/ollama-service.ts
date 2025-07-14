export interface OllamaResponse {
  message: {
    content: string
  }
}

export interface OllamaRequest {
  model: string
  messages: Array<{
    role: string
    content: string
  }>
  stream?: boolean
}

class OllamaService {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434'
  }

  async generateResponse(prompt: string, model: string = 'llama3.2'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        } as OllamaRequest),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const data: OllamaResponse = await response.json()
      return data.message.content
    } catch (error) {
      console.error('Ollama service error:', error)
      throw new Error('Failed to generate AI response')
    }
  }

  async extractFormData(text: string): Promise<any> {
    const prompt = `
      Extract nanopore sequencing form data from the following text.
      Return a JSON object with the following fields:
      - sampleName
      - submitterName
      - submitterEmail
      - labName
      - projectName
      - sequencingType
      - sampleType
      - libraryType
      - flowCellType
      - concentration
      - volume
      - purity
      - fragmentSize
      - priority
      - basecalling
      - demultiplexing
      - referenceGenome
      - analysisType
      - dataDelivery

      Text: ${text}
    `

    try {
      const response = await this.generateResponse(prompt)
      return JSON.parse(response)
    } catch (error) {
      console.error('Form extraction error:', error)
      return {}
    }
  }
}

export const aiService = new OllamaService() 