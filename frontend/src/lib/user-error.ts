// Use only for messages written by the UI, never for server response text.
export class UserInputError extends Error {}

export function userErrorMessage(error: Error): string {
  if (error instanceof UserInputError) return error.message
  const status = 'status' in error ? error.status : undefined
  switch (status) {
    case 400:
    case 422:
      return 'Check your entries and try again. If you followed a saved link, clear the filters.'
    case 401:
      return 'Sign in to continue. Check your username and password if you could not sign in.'
    case 403:
      return 'You do not have access to this action. Try signing in again if your session has expired.'
    case 404:
      return 'This item is no longer available. Refresh the page and try again.'
    case 409:
      return 'This item has changed or the action has already been completed. Refresh before trying again.'
    case 413:
      return 'This file is too large. Choose a PDF no larger than 10 MB.'
    case 429:
      return 'Please wait a moment before trying again.'
    default:
      return 'We could not complete this request. Please try again shortly.'
  }
}
