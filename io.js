const PATH = require('node:path')
const FS = require('fs-extra')

const IO = module.exports = {}
/*********************************************************************************
** File Operations
*********************************************************************************/
IO.readJson = async (path) => {
  return await FS.readJson(path)
}

IO.writeJson = async (path, json) => {
  return await FS.outputJson(path, json)
}

IO.readFile = async (path) => {
  return await FS.readFile(path)
}

IO.writeFile = async (path, data) => {
  return await FS.outputFile(path, data)
}

IO.appendFile = async (path, data) => {
  return await FS.appendFile(path, data)
}

IO.remove = async (path) => {
  return await FS.remove(path)
}

IO.oneJson = async (dirPath, { desire='newest' }={}) => {
  const files = await IO.readDir(dirPath, { absPath: true, sort: 'oldToNew' })
  if(files.length > 0) {
    if(desire == 'oldest')
      return await IO.readJson(files[0])
    else if(desire == 'newest')
      return await IO.readJson(files[files.length-1])
    return null
  }
  return null
}

IO.readFileWithVirtuals = async (rootPath, path) => {
  let content = (await IO.readFile(path)).toString()
  while(true) {
    const match = content.match(/<!--\s*#include\s+(file|virtual)="(.+?)"\s*-->/)
    if(!match)
      break
    const [ _, protocol, ssiPath ] = match
    const absSsiPath = PATH.join(rootPath, ssiPath)
    try {
      var ssiContent = await IO.readFileWithVirtuals(rootPath, absSsiPath)
    } catch(e) {
      var ssiContent = `<!-- failed to load virtual file at ${ssiPath} -->`
    }
    content = content.substring(0, match.index)
      + ssiContent
      + content.substring(match.index+match[0].length, content.length)
  }
  return content
}

IO.readDir = async (path, { absPaths=true, sort='alphabetical' }={}) => {
  if(await IO.isDir(path)) {
    const names = (await FS.readdir(path)) // includes files & directories
      .filter(n => n != '.DS_Store')
    const files = names.map(name => ({ name, path: PATH.join(path, name) }))

    if(sort == 'alphabetical') {
      files.sort((a,b) => {
        if(a.name < b.name) { return -1 }
        if(a.name > b.name) { return 1 }
        return 0
      })
    }
    else if(sort == 'oldToNew') {
      for(let f of files)
        f.modInstant = await IO.getModifiedInstant(f.path)
      files.sort((a,b) => {
        if(a.modInstant < b.modInstant) { return -1 }
        if(a.modInstant > b.modInstant) { return 1 }
        return 0
      })
    }

    return absPaths ? files.map(f => f.path) : files.map(f => f.name)
  }
  return []
}

// Will write data to path and remove the oldest file in the folder if there are too many files
IO.writeBackupFile = async (path, data, maxFiles = 10) => {
  const [ backupsDir, filename ] = IO.expandPath(path)

  await IO.writeFile(path, data)
  return await IO.pruneFiles(backupsDir, maxFiles)
}

// Limit the number of files in a folder, remove oldest files
IO.pruneFiles = async (dirPath, maxFiles = 10) => {
  const removed = []
  const files = await IO.readDir(dirPath, { sort: 'oldToNew' })
  if(files.length > maxFiles) {
    const numFilesToDelete = files.length - maxFiles
    for(let i=0; i<numFilesToDelete; i++) {
      await IO.remove(files[i])
      removed.push(files[i])
    }
  }
  return { removed, numFilesFound: files.length }
}

IO.isFile = async (path) => {
  const stat = await IO.getStat(path)
  return stat ? stat.isFile() : false
}

IO.isDir = async (path) => {
  const stat = await IO.getStat(path)
  return stat ? stat.isDirectory() : false
}

IO.getModifiedInstant = async (path) => {
  const stat = await IO.getStat(path)
  return stat ? stat.mtimeMs : false
}

IO.getCreatedInstant = async (path) => {
  const stat = await IO.getStat(path)
  return stat ? stat.ctimeMs : false
}

IO.getStat = async (path) => {
  try {
    return await FS.lstat(path)
  }
  catch(e) {
    return null
  }
}

IO.expandPath = (path) => {
  let folder = null
  let file = null
  if(path) {
    const i = path.lastIndexOf(PATH.sep)
    folder = path.slice(0,i)
    file = path.slice(i+1)
  }
  return [ folder, file ]
}

/*********************************************************************************
** CMD Operations
*********************************************************************************/
IO.getDiskUsage = async () => {
  try {
    const { code, outputLines } = await IO.execCmd(`df -h /`)
    const line = outputLines[1].split('\n')[1]
    const parts = line.split(' ').map(s => s.trim()).filter(s => !!s)
    return {
      size: parts[1],
      used: parts[2],
      available: parts[3],
      percentUsed: parts[4],
    }
  }
  catch(e) {
    console.log(e)
    return null
  }
}

IO.execCmds = async (cmds, cwd, out) => {
  cmds = Array.isArray(cmds) ? cmds : [ cmds ]

  const results = []
  try {
    for(let cmd of cmds)
      results.push( await IO.execCmd(cmd, cwd, out) )
    return {
      code: results[results.length-1].code,
      outputLines: [].concat(...results.map(r => r.outputLines)),
      message: ''.concat(...results.map(r => r.message)),
    }
  }
  catch(e) {
    e.outputLines = [].concat(...results.map(r => r.outputLines), e.outputLines)
    e.message = ''.concat(...results.map(r => r.message), e.message)
    throw e
  }
}

IO.execCmd = async (cmd, cwd, out) => {
  let outputLines = []
  cwd = cwd || __dirname
  // out = out || ((data) => console.log(`${data}`))
  out = out || ((data) => outputLines.push(data) )
  return new Promise((resolve, reject) => {
    const [base, ...args] = cmd.split(' ')
    const { spawn } = require('child_process')
    const prc = spawn(base, args, {
      cwd: cwd,
      // shell: true,
      // detached: true,
    })
    // prc.unref()
    out(`\n[SPAWN](${cwd})>${cmd}\n`)
    prc.stdout.on('data', (buffer) => out(buffer.toString()))
    prc.stderr.on('data', (buffer) => out(buffer.toString()))
    prc.on('close', (code) => {
      out(`[SPAWN] exited with code ${code}`)
      if(code == 0)
        resolve({ code, outputLines, message: outputLines.join('') })
      else
        reject({ code, outputLines, message: outputLines.join('') })
    })
  })
}

/*********************************************************************************
** Git Operations
*********************************************************************************/
IO.getGitCommit = async (cwd=null) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec('git rev-parse --short HEAD', { cwd }, async (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.getGitCommit](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

IO.getGitBranch = async (cwd=null) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec('git rev-parse --abbrev-ref HEAD', { cwd }, async (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.getGitBranch](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

IO.checkoutToGitBranch = async (branchName = null) => {
  if (branchName === null) {
    return Promise.reject('Please provide a branch name to checkout to.')
  }
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`git checkout ${branchName}`, {  }, async (err, stdout, stderr) => {
      if (err) {
        console.error(`[IO.checkoutToGitBranch](${branchName}):`)
        console.error(`\t Error -> ${err.code}`)
        console.error(`\t Message -> ${err.message}`)
        return resolve(`<${err.code}>`)
      }
      resolve(await IO.getGitBranch())
    })
  })
}

IO.getGitCommitTs = async (cwd=null) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec('git show', { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.getGitCommitTs](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      const lines = stdout.split('\n')
      const dateLine = lines.find(line => line.indexOf('Date:') == 0)
      let date = new Date(dateLine)
      if(isNaN(date.getTime())) {
        console.log(`[IO.getGitCommitTs](${cwd}): Error Invalid Date`)
        return resolve('<invalid-date>')
      }
      const jstOffset = 9 * 3600 * 1000
      date = new Date(date.getTime() + jstOffset)
      const ds = date.toISOString().replace('Z', '+09:00')
      resolve(ds)
    })
  })
}

// Returns only the changed lines from the staged git diff
IO.getGitDiff = async (cwd = null) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec('git diff --cached', { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.getGitDiff](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      // Only keep lines starting with diff, index, ---/+++, @@, +, or - (but not --- or +++)
      const lines = stdout.split('\n')
      const filtered = lines.filter(line => {
        if (line.startsWith('diff --git')) return true
        if (line.startsWith('index ')) return true
        if (line.startsWith('@@')) return true
        if (line.startsWith('+') && !line.startsWith('+++')) return true
        if (line.startsWith('-') && !line.startsWith('---')) return true
        if (line.startsWith('new file mode')) return true
        if (line.startsWith('deleted file mode')) return true
        if (line.startsWith('--- ') || line.startsWith('+++ ')) return false
        return false
      })
      resolve(filtered.join('\n').trim())
    })
  })
}

IO.gitCommit = async (msg, cwd = null) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`git commit -m "${msg}"`, { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.gitCommit](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

IO.gitAddAll = async () => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`git add -A`, (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.gitAddAll]: Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

IO.getCommitAuthorEmail = async () => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec('git config user.email', (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.getCommitAuthorEmail](${cwd}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

IO.branchExists = async (branchName) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`git show-ref --verify --quiet refs/heads/${branchName}`, (err, stdout, stderr) => {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

IO.createBranch = async (branchName) => {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`git checkout -b ${branchName}`, (err, stdout, stderr) => {
      if (err) {
        console.log(`[IO.createBranch](${branchName}): Error ${err.code}`)
        return resolve(`<${err.code}>`)
      }
      resolve(stdout.trim())
    })
  })
}

