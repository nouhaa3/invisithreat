import api from './api'

export const getGitHubAppInstallUrl = async () => {
  const res = await api.get('/api/integrations/github/app/install-url')
  return res.data
}

export const getGitHubOAuthStart = async () => {
  const res = await api.get('/api/integrations/github/oauth/start')
  return res.data
}

export const exchangeGitHubOAuthCode = async ({ code, state, project_id, repo_url, repo_branch }) => {
  const res = await api.post('/api/integrations/github/oauth/exchange', {
    code,
    state,
    project_id,
    repo_url,
    repo_branch,
  })
  return res.data
}
