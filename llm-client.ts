import * as fs from 'fs';
import * as path from 'path';

const LLM_API_URL = process.env.LLM_API_URL || 'https://llmrouter-production.up.railway.app/api/query';
const CONTEXT_FILE = path.join(__dirname, 'property_context.json');

interface LLMRequest {
  prompt: string;
  llm?: 'claude' | 'gemini';
  context_source?: 'sqlite' | 'file' | 'json';
  context_config?: {
    file_path?: string;
    json_path?: string;
    db_path?: string;
    query?: string;
  };
}

interface LLMResponse {
  response: string;
  llm_used: string;
  context_loaded: boolean;
  context_summary?: string;
}

/**
 * LLM Client for generating tenant responses
 */
export class LLMClient {
  private apiUrl: string;
  private contextPath: string;

  constructor(apiUrl?: string, contextPath?: string) {
    this.apiUrl = apiUrl || LLM_API_URL;
    this.contextPath = contextPath || CONTEXT_FILE;
  }

  /**
   * Generate a response to a tenant's message
   */
  async generateResponse(
    tenantName: string,
    tenantMessage: string,
    tenantEmail?: string
  ): Promise<string> {
    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(tenantName, tenantMessage, tenantEmail);

      // Prepare LLM request with property context
      const request: LLMRequest = {
        prompt,
        llm: 'claude',
        context_source: 'json',
        context_config: {
          file_path: this.contextPath,
          json_path: 'property_details'
        }
      };

      // Call LLM API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data: LLMResponse = await response.json();

      if (!data.response) {
        throw new Error('LLM API returned empty response');
      }

      return data.response;

    } catch (error) {
      console.error('Error generating LLM response:', error);
      throw error;
    }
  }

  /**
   * Build a structured prompt for the LLM
   */
  private buildPrompt(
    tenantName: string,
    tenantMessage: string,
    tenantEmail?: string
  ): string {
    return `You are a professional property manager responding to a rental inquiry for your Furnished Finder property in Lander, Wyoming.

TENANT INFORMATION:
- Name: ${tenantName}
${tenantEmail ? `- Email: ${tenantEmail}` : ''}

TENANT'S MESSAGE:
${tenantMessage}

INSTRUCTIONS:
1. Review the property details provided in the context
2. Generate a warm, professional, and helpful response
3. Answer any specific questions the tenant asked
4. Highlight relevant amenities that match their needs
5. If they mention pets, healthcare work, or specific requirements, address those directly
6. Keep the tone friendly but professional
7. Include a clear call-to-action (e.g., "Feel free to send a booking inquiry" or "Let me know if you have any other questions")
8. Sign off appropriately but don't include a signature line (the platform will add that)

RESPONSE GUIDELINES:
- Be concise (2-4 paragraphs maximum)
- Use a conversational, welcoming tone
- Emphasize the property's suitability for their needs
- If availability is mentioned, remind them to check current dates on the listing
- If pricing questions arise, be clear about what's included

Generate the response now:`;
  }

  /**
   * Health check for LLM API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const healthUrl = this.apiUrl.replace('/api/query', '/health');
      const response = await fetch(healthUrl);
      return response.ok;
    } catch (error) {
      console.error('LLM API health check failed:', error);
      return false;
    }
  }

  /**
   * Get property context for debugging
   */
  getPropertyContext(): any {
    try {
      const content = fs.readFileSync(this.contextPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading property context:', error);
      return null;
    }
  }
}

// Export singleton instance
export const llmClient = new LLMClient();
