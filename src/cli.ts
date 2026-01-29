#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { format } from 'date-fns';

import {
  createNote,
  listNotes,
  getNote,
  addActionPoint,
  getPendingActionPoints,
} from './services/notes.js';
import { extractActionPoints } from './services/actionExtractor.js';
import { createCalendarEvent } from './services/calendar.js';
import { sendEmail, openEmailDraft, generateActionPointsEmail } from './services/email.js';
import {
  loadConfig,
  saveConfig,
  addProject,
  listProjects,
  getProject,
} from './utils/config.js';
import {
  findRelatedNotes,
  linkNotes,
  getLinkedNotes,
  autoLinkRelatedNotes,
  updateNoteWithObsidianLinks,
} from './services/noteLinking.js';

const program = new Command();

program
  .name('highlight-workflow')
  .description('CLI for managing Highlight notes, action points, calendar, and email')
  .version('1.0.0');

// ============ Project Commands ============

program
  .command('project:add')
  .description('Add a new project')
  .argument('<name>', 'Project name')
  .option('-p, --path <path>', 'Storage path', '')
  .option('-s, --storage <type>', 'Storage type: local, obsidian, notion', 'local')
  .action(async (name, options) => {
    const path = options.path || name;
    addProject({ name, path, storage: options.storage });
    console.log(chalk.green(`✓ Project "${name}" added`));
  });

program
  .command('project:list')
  .description('List all projects')
  .action(() => {
    const projects = listProjects();
    const config = loadConfig();

    if (projects.length === 0) {
      console.log(chalk.yellow('No projects configured. Run: highlight-workflow project:add <name>'));
      return;
    }

    console.log(chalk.bold('\nProjects:\n'));
    projects.forEach(p => {
      const isDefault = p.name === config.defaultProject ? chalk.cyan(' (default)') : '';
      console.log(`  ${chalk.green(p.name)}${isDefault}`);
      console.log(`    Path: ${p.path}`);
      console.log(`    Storage: ${p.storage}\n`);
    });
  });

// ============ Note Commands ============

program
  .command('note:add')
  .description('Add a new note to a project')
  .argument('<project>', 'Project name')
  .argument('<title>', 'Note title')
  .option('-c, --content <content>', 'Note content')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-e, --extract', 'Extract action points from content')
  .action(async (project, title, options) => {
    const proj = getProject(project);
    if (!proj) {
      console.log(chalk.red(`Project "${project}" not found`));
      return;
    }

    let content = options.content || '';

    // If no content, prompt for it
    if (!content) {
      const answers = await inquirer.prompt([
        {
          type: 'editor',
          name: 'content',
          message: 'Enter note content (opens editor):',
        },
      ]);
      content = answers.content;
    }

    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
    const note = createNote(project, title, content, tags);

    if (options.extract) {
      const extracted = extractActionPoints(content);
      for (const action of extracted) {
        addActionPoint(project, note.id, {
          description: action.description,
          assignee: action.assignee,
          dueDate: action.dueDate,
          priority: action.priority,
          status: 'pending',
        });
      }
      console.log(chalk.green(`✓ Note created with ${extracted.length} action points`));
    } else {
      console.log(chalk.green(`✓ Note "${title}" created in ${project}`));
    }

    console.log(`  ID: ${note.id}`);
    console.log(`  Date: ${note.date}`);
  });

program
  .command('note:list')
  .description('List notes in a project')
  .argument('<project>', 'Project name')
  .action((project) => {
    const notes = listNotes(project);

    if (notes.length === 0) {
      console.log(chalk.yellow('No notes found'));
      return;
    }

    console.log(chalk.bold(`\nNotes in ${project}:\n`));
    notes.forEach(n => {
      console.log(`  ${chalk.cyan(n.date)} - ${chalk.white(n.title)}`);
      console.log(`    ID: ${n.id}`);
      if (n.tags.length) console.log(`    Tags: ${n.tags.join(', ')}`);
      if (n.actionPoints.length) {
        console.log(`    Action points: ${n.actionPoints.length}`);
      }
      console.log('');
    });
  });

// ============ Action Point Commands ============

program
  .command('action:list')
  .description('List pending action points')
  .option('-p, --project <project>', 'Filter by project')
  .action((options) => {
    const actions = getPendingActionPoints(options.project);

    if (actions.length === 0) {
      console.log(chalk.green('No pending action points'));
      return;
    }

    console.log(chalk.bold('\nPending Action Points:\n'));

    const byPriority = {
      high: actions.filter(a => a.priority === 'high'),
      medium: actions.filter(a => a.priority === 'medium'),
      low: actions.filter(a => a.priority === 'low'),
    };

    for (const [priority, items] of Object.entries(byPriority)) {
      if (items.length === 0) continue;

      const color = priority === 'high' ? chalk.red : priority === 'medium' ? chalk.yellow : chalk.gray;
      console.log(color.bold(`  ${priority.toUpperCase()} PRIORITY`));

      items.forEach(a => {
        console.log(`    [ ] ${a.description}`);
        if (a.assignee) console.log(`        Assignee: ${a.assignee}`);
        if (a.dueDate) console.log(`        Due: ${a.dueDate}`);
        console.log(`        ID: ${a.id}\n`);
      });
    }
  });

program
  .command('action:add')
  .description('Add an action point to a note')
  .argument('<project>', 'Project name')
  .argument('<noteId>', 'Note ID')
  .argument('<description>', 'Action description')
  .option('-a, --assignee <name>', 'Assignee name')
  .option('-d, --due <date>', 'Due date')
  .option('-p, --priority <level>', 'Priority: low, medium, high', 'medium')
  .action((project, noteId, description, options) => {
    const result = addActionPoint(project, noteId, {
      description,
      assignee: options.assignee,
      dueDate: options.due,
      priority: options.priority,
      status: 'pending',
    });

    if (result) {
      console.log(chalk.green('✓ Action point added'));
      console.log(`  ID: ${result.id}`);
    } else {
      console.log(chalk.red('Note not found'));
    }
  });

// ============ Calendar Commands ============

program
  .command('calendar:add')
  .description('Add an action point to calendar')
  .argument('[actionId]', 'Action point ID (interactive if omitted)')
  .option('-p, --project <project>', 'Filter by project')
  .option('-t, --time <datetime>', 'Event start time (ISO format)')
  .option('-d, --duration <minutes>', 'Duration in minutes', '60')
  .option('--provider <type>', 'Calendar: google, outlook')
  .action(async (actionId, options) => {
    const actions = getPendingActionPoints(options.project);

    if (actions.length === 0) {
      console.log(chalk.yellow('No pending action points'));
      return;
    }

    let selectedAction;

    if (actionId) {
      selectedAction = actions.find(a => a.id === actionId);
      if (!selectedAction) {
        console.log(chalk.red('Action point not found'));
        return;
      }
    } else {
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select action point to add to calendar:',
          choices: actions.map(a => ({
            name: `[${a.priority}] ${a.description.substring(0, 60)}`,
            value: a,
          })),
        },
      ]);
      selectedAction = selected;
    }

    let startTime = options.time;
    if (!startTime) {
      const { time } = await inquirer.prompt([
        {
          type: 'input',
          name: 'time',
          message: 'Start time (YYYY-MM-DDTHH:mm):',
          default: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        },
      ]);
      startTime = time;
    }

    const { provider } = options.provider
      ? { provider: options.provider }
      : await inquirer.prompt([
          {
            type: 'list',
            name: 'provider',
            message: 'Select calendar:',
            choices: ['google', 'outlook'],
          },
        ]);

    try {
      const endTime = format(
        new Date(new Date(startTime).getTime() + parseInt(options.duration) * 60000),
        "yyyy-MM-dd'T'HH:mm:ss"
      );

      const result = await createCalendarEvent(
        {
          title: `[Action] ${selectedAction.description.substring(0, 50)}`,
          description: selectedAction.description,
          startTime: startTime + ':00',
          endTime,
        },
        provider
      );

      console.log(chalk.green('✓ Added to calendar'));
      console.log(`  Link: ${result}`);
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

// ============ Email Commands ============

program
  .command('email:actions')
  .description('Email action points')
  .argument('<to>', 'Recipient email (comma-separated for multiple)')
  .option('-p, --project <project>', 'Filter by project')
  .option('-s, --subject <subject>', 'Email subject')
  .option('-m, --method <type>', 'Method: draft, gmail, outlook', 'draft')
  .option('--send', 'Send immediately instead of creating draft')
  .action(async (to, options) => {
    const actions = getPendingActionPoints(options.project);

    if (actions.length === 0) {
      console.log(chalk.yellow('No pending action points'));
      return;
    }

    const recipients = to.split(',').map((e: string) => e.trim());
    const emailDraft = generateActionPointsEmail(actions, options.subject);
    emailDraft.to = recipients;

    try {
      if (options.send) {
        const result = await sendEmail(emailDraft, options.method);
        console.log(chalk.green(`✓ ${result}`));
      } else {
        const result = await openEmailDraft(emailDraft);
        console.log(chalk.green(`✓ ${result}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

// ============ Config Commands ============

program
  .command('config:show')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(chalk.bold('\nCurrent Configuration:\n'));
    console.log(JSON.stringify(config, null, 2));
  });

program
  .command('config:set')
  .description('Set configuration values')
  .argument('<key>', 'Config key (e.g., defaultCalendar, obsidianVaultPath)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    const config = loadConfig();

    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    saveConfig(config);

    console.log(chalk.green(`✓ Set ${key} = ${value}`));
  });

program
  .command('config:google')
  .description('Configure Google OAuth credentials')
  .action(async () => {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'clientId', message: 'Google Client ID:' },
      { type: 'password', name: 'clientSecret', message: 'Google Client Secret:' },
      { type: 'input', name: 'refreshToken', message: 'Refresh Token:' },
    ]);

    const config = loadConfig();
    config.google = answers;
    saveConfig(config);

    console.log(chalk.green('✓ Google credentials saved'));
  });

program
  .command('config:microsoft')
  .description('Configure Microsoft OAuth credentials')
  .action(async () => {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'clientId', message: 'Microsoft Client ID:' },
      { type: 'password', name: 'clientSecret', message: 'Microsoft Client Secret:' },
      { type: 'input', name: 'tenantId', message: 'Tenant ID:' },
      { type: 'input', name: 'refreshToken', message: 'Refresh Token:' },
    ]);

    const config = loadConfig();
    config.microsoft = answers;
    saveConfig(config);

    console.log(chalk.green('✓ Microsoft credentials saved'));
  });

// ============ Note Linking Commands ============

program
  .command('link:find')
  .description('Find related notes')
  .argument('<project>', 'Project name')
  .argument('<noteId>', 'Note ID')
  .option('-l, --limit <number>', 'Maximum results', '5')
  .option('-s, --score <number>', 'Minimum relevance score', '15')
  .action((project, noteId, options) => {
    const related = findRelatedNotes(
      project,
      noteId,
      parseInt(options.limit),
      parseInt(options.score)
    );

    if (related.length === 0) {
      console.log(chalk.yellow('No related notes found'));
      return;
    }

    console.log(chalk.bold('\nRelated Notes:\n'));
    related.forEach(r => {
      const scoreColor = r.relevanceScore! > 30 ? chalk.green : chalk.yellow;
      console.log(`  ${scoreColor(`${r.relevanceScore}%`)} - ${chalk.white(r.noteTitle)}`);
      console.log(`    Project: ${r.project}`);
      console.log(`    ID: ${r.noteId}\n`);
    });
  });

program
  .command('link:add')
  .description('Link two notes together')
  .argument('<sourceProject>', 'Source project')
  .argument('<sourceNoteId>', 'Source note ID')
  .argument('<targetProject>', 'Target project')
  .argument('<targetNoteId>', 'Target note ID')
  .action((sourceProject, sourceNoteId, targetProject, targetNoteId) => {
    const result = linkNotes(sourceProject, sourceNoteId, targetProject, targetNoteId);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(result.message));
    }
  });

program
  .command('link:list')
  .description('List linked notes')
  .argument('<project>', 'Project name')
  .argument('<noteId>', 'Note ID')
  .action((project, noteId) => {
    const links = getLinkedNotes(project, noteId);

    if (links.length === 0) {
      console.log(chalk.yellow('No linked notes'));
      return;
    }

    console.log(chalk.bold('\nLinked Notes:\n'));
    links.forEach(l => {
      const icon = l.linkType === 'backlink' ? '⬅️ ' : l.linkType === 'related' ? '🔗 ' : '➡️ ';
      console.log(`  ${icon}${chalk.white(l.noteTitle)}`);
      console.log(`    Type: ${l.linkType}`);
      console.log(`    Project: ${l.project}`);
      if (l.relevanceScore) console.log(`    Score: ${l.relevanceScore}%`);
      console.log('');
    });
  });

program
  .command('link:auto')
  .description('Automatically link related notes')
  .argument('<project>', 'Project name')
  .argument('<noteId>', 'Note ID')
  .option('-l, --limit <number>', 'Maximum links to create', '3')
  .option('-s, --score <number>', 'Minimum relevance score', '20')
  .action((project, noteId, options) => {
    const newLinks = autoLinkRelatedNotes(
      project,
      noteId,
      parseInt(options.limit),
      parseInt(options.score)
    );

    if (newLinks.length === 0) {
      console.log(chalk.yellow('No new related notes found to link'));
      return;
    }

    console.log(chalk.green(`✓ Auto-linked ${newLinks.length} notes:\n`));
    newLinks.forEach(l => {
      console.log(`  🔗 ${l.noteTitle} (${l.relevanceScore}% match)`);
    });
  });

program
  .command('link:obsidian')
  .description('Update note with Obsidian [[wikilinks]]')
  .argument('<project>', 'Project name')
  .argument('<noteId>', 'Note ID')
  .action((project, noteId) => {
    const note = updateNoteWithObsidianLinks(project, noteId);

    if (!note) {
      console.log(chalk.red('Note not found'));
      return;
    }

    console.log(chalk.green('✓ Note updated with Obsidian wikilinks'));
    console.log(`  Linked notes: ${note.linkedNotes?.length || 0}`);
  });

program.parse();
