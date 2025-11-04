import { FunctionDeclaration, Type } from '@google/genai';

export const promoteToSpeakerDeclaration: FunctionDeclaration = {
  name: 'promoteToSpeaker',
  parameters: {
    type: Type.OBJECT,
    description: "Promotes a user from the listener list to the speaker list, allowing them to talk.",
    properties: {
      username: {
        type: Type.STRING,
        description: "The exact username of the person to promote to speaker. It must match a name from the listeners list.",
      },
    },
    required: ['username'],
  },
};

export const demoteToListenerDeclaration: FunctionDeclaration = {
  name: 'demoteToListener',
  parameters: {
    type: Type.OBJECT,
    description: "Demotes a user from the speaker list to the listener list, revoking their speaking permissions.",
    properties: {
      username: {
        type: Type.STRING,
        description: "The exact username of the person to demote to listener. It must match a name from the speakers list.",
      },
    },
    required: ['username'],
  },
};

export const moderationTools = [{ 
    functionDeclarations: [promoteToSpeakerDeclaration, demoteToListenerDeclaration] 
}];
