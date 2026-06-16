import type { GraphModel } from './types';

export const sampleGraph: GraphModel = {
	focusNodeId: 'focus:sendWelcomeEmail',
	nodes: [
		{
			id: 'caller:createUser',
			label: 'createUser',
			filePath: 'app/users.py',
			line: 18,
			role: 'caller',
		},
		{
			id: 'caller:inviteUser',
			label: 'inviteUser',
			filePath: 'app/invitations.py',
			line: 42,
			role: 'caller',
		},
		{
			id: 'focus:sendWelcomeEmail',
			label: 'EmailService.sendWelcomeEmail',
			filePath: 'app/email_service.py',
			line: 12,
			role: 'focus',
		},
		{
			id: 'callee:renderTemplate',
			label: 'renderTemplate',
			filePath: 'app/templates.py',
			line: 7,
			role: 'callee',
		},
		{
			id: 'callee:queueMessage',
			label: 'queueMessage',
			filePath: 'app/queue.py',
			line: 31,
			role: 'callee',
		},
	],
	edges: [
		{
			id: 'edge:createUser:sendWelcomeEmail',
			from: 'caller:createUser',
			to: 'focus:sendWelcomeEmail',
			label: 'direct call',
		},
		{
			id: 'edge:inviteUser:sendWelcomeEmail',
			from: 'caller:inviteUser',
			to: 'focus:sendWelcomeEmail',
			label: 'direct call',
		},
		{
			id: 'edge:sendWelcomeEmail:renderTemplate',
			from: 'focus:sendWelcomeEmail',
			to: 'callee:renderTemplate',
			label: 'same file',
		},
		{
			id: 'edge:sendWelcomeEmail:queueMessage',
			from: 'focus:sendWelcomeEmail',
			to: 'callee:queueMessage',
			label: 'same file',
		},
	],
	unresolvedCalls: [
		'getattr(handler, action)()',
		'plugin.run(payload)',
	],
	externalCalls: [
		'logging.info(...)',
		'smtplib.SMTP(...)',
	],
};
