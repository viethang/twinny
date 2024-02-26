import {
  ColorThemeKind,
  ConfigurationTarget,
  Position,
  Range,
  TextDocument,
  commands,
  window,
  workspace
} from 'vscode'

import {
  Theme,
  LanguageType,
  ApiProviders,
  StreamResponse,
  StreamRequest,
  PrefixSuffix
} from '../common/types'
import { supportedLanguages } from '../common/languages'
import {
  API_PROVIDER,
  EXTENSION_NAME,
  PROVIDER_NAMES
} from '../common/constants'
import { Logger } from '../common/logger'

const logger = new Logger()

export const delayExecution = <T extends () => void>(
  fn: T,
  delay = 200
): NodeJS.Timeout => {
  return setTimeout(() => {
    fn()
  }, delay)
}

export const getTextSelection = () => {
  const editor = window.activeTextEditor
  const selection = editor?.selection
  const text = editor?.document.getText(selection)
  return text || ''
}

export const getLanguage = (): LanguageType => {
  const editor = window.activeTextEditor
  const languageId = editor?.document.languageId
  const language =
    supportedLanguages[languageId as keyof typeof supportedLanguages]
  return {
    language,
    languageId
  }
}

export const getPrefixSuffix = (
  numLines: number,
  document: TextDocument,
  position: Position,
  contextRatio = [0.15, 0.85]
): PrefixSuffix => {
  const currentLine = position.line
  const numLinesToEnd = document.lineCount - currentLine

  let numLinesPrefix = Math.floor(Math.abs(numLines * contextRatio[0]))
  let numLinesSuffix = Math.ceil(Math.abs(numLines * contextRatio[1]))

  if (numLinesSuffix > numLinesToEnd) {
    numLinesPrefix += numLinesSuffix - numLinesToEnd
    numLinesSuffix = numLinesToEnd
  }

  const prefixRange = new Range(
    Math.max(0, currentLine - numLinesPrefix),
    0,
    currentLine,
    position.character
  )
  const suffixRange = new Range(
    currentLine,
    position.character,
    currentLine + numLinesSuffix,
    0
  )

  return {
    prefix: document.getText(prefixRange),
    suffix: document.getText(suffixRange)
  }
}

export const getTheme = () => {
  const currentTheme = window.activeColorTheme
  if (currentTheme.kind === ColorThemeKind.Light) {
    return Theme.Light
  } else if (currentTheme.kind === ColorThemeKind.Dark) {
    return Theme.Dark
  } else {
    return Theme.Contrast
  }
}

export const setApiDefaults = () => {
  const config = workspace.getConfiguration('twinny')

  const provider = config.get('apiProvider') as string

  if (PROVIDER_NAMES.includes(provider)) {
    const { fimApiPath, chatApiPath, port } = API_PROVIDER[provider]
    config.update('fimApiPath', fimApiPath, ConfigurationTarget.Global)
    config.update('chatApiPath', chatApiPath, ConfigurationTarget.Global)
    config.update('chatApiPort', port, ConfigurationTarget.Global)
    config.update('fimApiPort', port, ConfigurationTarget.Global)
    commands.executeCommand('workbench.action.openSettings', EXTENSION_NAME)
  }
}

export const getChatDataFromProvider = (
  provider: string,
  data: StreamResponse | undefined
) => {
  switch (provider) {
    case ApiProviders.Ollama:
      return data?.response
    case ApiProviders.LlamaCpp:
      return data?.content
    default:
      if (data?.choices[0].delta.content === 'undefined') {
        return ''
      }
      return data?.choices[0].delta?.content
        ? data?.choices[0].delta.content
        : ''
  }
}

export const getFimDataFromProvider = (
  provider: string,
  data: StreamResponse | undefined
) => {
  switch (provider) {
    case ApiProviders.Ollama:
      return data?.response
    case ApiProviders.LlamaCpp:
      return data?.content
    default:
      if (!data?.choices.length) return
      if (data?.choices[0].text === 'undefined') {
        return ''
      }
      return data?.choices[0].text ? data?.choices[0].text : ''
  }
}

export function isStreamWithDataPrefix(stringBuffer: string) {
  return stringBuffer.startsWith('data:')
}

export function safeParseJsonResponse(
  stringBuffer: string
): StreamResponse | undefined {
  try {
    if (isStreamWithDataPrefix(stringBuffer)) {
      return JSON.parse(stringBuffer.split('data:')[1])
    }
    return JSON.parse(stringBuffer)
  } catch (e) {
    return undefined
  }
}

export const logStreamOptions = (opts: StreamRequest) => {
  logger.log(
    `
***Twinny Stream Debug***\n\
Streaming response from ${opts.options.hostname}:${opts.options.port}.\n\
Request body:\n${JSON.stringify(opts.body, null, 2)}\n\n
Request options:\n${JSON.stringify(opts.options, null, 2)}\n\n
    `
  )
}
