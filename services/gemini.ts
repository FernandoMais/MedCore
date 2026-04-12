
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// Strictly following initialization guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getICDRecommendation = async (symptoms: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base nos seguintes sintomas: "${symptoms}", sugira os códigos CID-10 e diagnósticos prováveis mais relevantes. Responda em formato de lista simples.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao obter recomendações de CID.";
  }
};

export const summarizePatientHistory = async (patientName: string, history: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Resuma o histórico médico do paciente ${patientName} de forma concisa para um médico ler em segundos: ${history}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text;
  } catch (error) {
    return "Não foi possível resumir o histórico.";
  }
};

export const generatePrescriptionDraft = async (diagnosis: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crie um rascunho de prescrição comum para o diagnóstico: "${diagnosis}". Inclua medicação, dosagem e posologia padrão. OBS: Este é apenas um rascunho informativo.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medication: { type: Type.STRING },
              dosage: { type: Type.STRING },
              frequency: { type: Type.STRING },
              duration: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    return [];
  }
};
