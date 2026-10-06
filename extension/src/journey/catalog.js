/**
 * Journey Optimizer activity catalog.
 * Each entry drives the editor (fields), the validator (category) and training mode
 * (what / why / howInAjo / pitfalls) so a new team member understands every step they build.
 */

export const CATEGORIES = {
    entry: 'Entry',
    flow: 'Orchestration',
    action: 'Action',
    end: 'End'
};

export const ACTIVITIES = {
    // ---------- Entry ----------
    unitaryEvent: {
        category: 'entry',
        label: 'Unitary event',
        color: '#12805c',
        fields: [
            { key: 'eventName', label: 'Event', type: 'event', required: true },
            { key: 'reentrance', label: 'Re-entrance', type: 'select', options: ['not allowed', 'allowed after wait', 'allowed'], default: 'allowed after wait' },
            { key: 'reentryWaitDays', label: 'Re-entry wait (days)', type: 'number', default: 7 }
        ],
        what: 'Starts the journey for one person the moment a specific event arrives (e.g. cart abandoned, account created).',
        why: 'Use for real-time, behaviour-triggered journeys where timing matters.',
        howInAjo: [
            'Journey Optimizer → Administration → Configurations → Events: make sure the event exists and has an identity namespace.',
            'Drag the event from the "Events" section of the palette onto the canvas as the first activity.',
            'In the journey properties set re-entrance and the re-entrance wait period.'
        ],
        pitfalls: [
            'The event must carry the identity used as the journey namespace, otherwise nobody enters.',
            'Allowing re-entrance with no wait can spam people who fire the event repeatedly.'
        ]
    },
    businessEvent: {
        category: 'entry',
        label: 'Business event',
        color: '#12805c',
        fields: [
            { key: 'eventName', label: 'Business event', type: 'event', required: true },
            { key: 'audienceName', label: 'Audience to read', type: 'audience', required: true }
        ],
        what: 'A non-person event (e.g. product back in stock) that then reads an audience and sends everyone in it through the journey.',
        why: 'Use for one-to-many triggers like price drops, back-in-stock or weather alerts.',
        howInAjo: [
            'Create the event with type "Business" under Configurations → Events.',
            'Drag it onto the canvas; AJO automatically adds a Read audience activity after it - pick the audience there.'
        ],
        pitfalls: ['Business event journeys have their own throughput limits - check guardrails for large audiences.']
    },
    readAudience: {
        category: 'entry',
        label: 'Read audience',
        color: '#12805c',
        fields: [
            { key: 'audienceName', label: 'Audience', type: 'audience', required: true },
            { key: 'schedule', label: 'Schedule', type: 'select', options: ['once', 'daily', 'weekly', 'monthly'], default: 'once' },
            { key: 'throttle', label: 'Reading rate (profiles/sec)', type: 'number', default: 5000 }
        ],
        what: 'Starts the journey for everyone in an audience, once or on a schedule (batch).',
        why: 'Use for newsletters, campaigns to a segment, recurring reminders.',
        howInAjo: [
            'Drag "Read audience" from the Orchestration section as the first activity.',
            'Choose the audience and namespace, then open the schedule settings (clock icon) and set the frequency.'
        ],
        pitfalls: [
            'A "once" journey stops reading after the first run - people who qualify later never enter.',
            'Recurring reads re-enter people already in the journey only if "incremental read" is off.'
        ]
    },
    audienceQualification: {
        category: 'entry',
        label: 'Audience qualification',
        color: '#12805c',
        fields: [
            { key: 'audienceName', label: 'Audience', type: 'audience', required: true },
            { key: 'behavior', label: 'Trigger on', type: 'select', options: ['enters audience', 'exits audience'], default: 'enters audience' }
        ],
        what: 'Starts the journey when a person enters (or exits) an audience.',
        why: 'Use for lifecycle moments like "became VIP" or "lapsed customer".',
        howInAjo: ['Drag "Audience qualification" as the first activity, pick the audience and choose Realized (enters) or Exited.'],
        pitfalls: ['Use a streaming audience - batch audiences qualify everyone at once after the daily evaluation, which causes a spike.']
    },

    // ---------- Orchestration ----------
    wait: {
        category: 'flow',
        label: 'Wait',
        color: '#7e4bd6',
        fields: [
            { key: 'amount', label: 'Duration', type: 'number', default: 1 },
            { key: 'unit', label: 'Unit', type: 'select', options: ['minutes', 'hours', 'days'], default: 'days' }
        ],
        what: 'Pauses each person for a set time before the next step.',
        why: 'Give people time to act before following up, and avoid sending messages back to back.',
        howInAjo: ['Drag "Wait" from Orchestration, choose Duration, enter the amount and unit.'],
        pitfalls: ['Max wait in AJO is 29 days; the journey timeout (default 30 days) ends people waiting longer.']
    },
    condition: {
        category: 'flow',
        label: 'Condition',
        color: '#7e4bd6',
        branching: true,
        fields: [
            { key: 'kind', label: 'Condition type', type: 'select', options: ['data source', 'time', 'percentage split', 'date'], default: 'data source' }
        ],
        what: 'Sends people down different paths based on profile data, event data, time of day or a random split.',
        why: 'Personalise the path (e.g. VIPs get a different offer) or A/B test journey paths.',
        howInAjo: [
            'Drag "Condition" from Orchestration and choose the condition type.',
            'Add one path per branch with the expression editor; tick "Show path for other cases than the one(s) above" for the fallback.'
        ],
        pitfalls: [
            'Without an "other cases" path, people matching no branch silently leave the journey.',
            'Profile attributes are read when the person reaches the condition, not when they entered.'
        ]
    },
    reaction: {
        category: 'flow',
        label: 'Reaction',
        color: '#7e4bd6',
        branching: true,
        fields: [
            { key: 'toMessage', label: 'React to message (node id)', type: 'message', required: true },
            { key: 'timeoutDays', label: 'Timeout (days)', type: 'number', default: 3 }
        ],
        what: 'Waits for the person to react (open, click, receive) to an earlier message, with a timeout path if they do not.',
        why: 'Follow up only with people who did not engage, or reward those who clicked.',
        howInAjo: [
            'Drop "Reaction" right after a channel action - AJO links it to that message.',
            'Pick the reaction type per path (Email opened / clicked …) and enable the timeout path.'
        ],
        pitfalls: ['Opens are unreliable (Apple Mail Privacy Protection) - prefer clicks for decisions.']
    },
    eventWait: {
        category: 'flow',
        label: 'Wait for event',
        color: '#7e4bd6',
        branching: true,
        fields: [
            { key: 'eventName', label: 'Event', type: 'event', required: true },
            { key: 'timeoutDays', label: 'Timeout (days)', type: 'number', default: 2 }
        ],
        what: 'Holds the person until a second event arrives (e.g. purchase), with a timeout path.',
        why: 'Stop nudging people who already converted.',
        howInAjo: ['Drag the event from the Events palette mid-journey and enable "Set an event timeout" with a timeout path.'],
        pitfalls: ['The event must use the same namespace as the journey entry.']
    },
    jump: {
        category: 'flow',
        label: 'Jump',
        color: '#7e4bd6',
        fields: [{ key: 'targetJourney', label: 'Target journey', type: 'text', required: true }],
        what: 'Moves the person into another journey.',
        why: 'Hand off to a reusable journey (e.g. onboarding → nurture) instead of copying steps.',
        howInAjo: ['Drag "Jump" from Orchestration and choose the target journey (it must start with an event).'],
        pitfalls: ['The target journey must be live and start with a unitary event.']
    },
    updateProfile: {
        category: 'flow',
        label: 'Update profile',
        color: '#7e4bd6',
        fields: [
            { key: 'field', label: 'Profile field', type: 'field', required: true },
            { key: 'value', label: 'Value / expression', type: 'text' }
        ],
        what: 'Writes a value back to the profile (e.g. "welcome_series_completed = true").',
        why: 'Record journey progress so audiences and other journeys can use it.',
        howInAjo: ['Drag "Update profile" from Orchestration, pick a profile-enabled dataset, the field and the value.'],
        pitfalls: ['Only works with fields in a profile-enabled dataset that uses the journey namespace as primary identity.']
    },

    // ---------- Actions ----------
    email: {
        category: 'action',
        label: 'Email',
        color: '#1473e6',
        fields: [
            { key: 'message', label: 'Message name', type: 'text', required: true },
            { key: 'surface', label: 'Channel surface', type: 'text' },
            { key: 'brief', label: 'Content brief (for the content team)', type: 'textarea' }
        ],
        what: 'Sends an email.',
        why: 'Primary channel for rich content and offers.',
        howInAjo: [
            'Drag "Email" from Actions, choose the email channel configuration (surface).',
            'Click "Edit content" to design the email or start from a content template.'
        ],
        pitfalls: ['Marketing vs transactional surface controls whether consent/suppression is applied.']
    },
    push: {
        category: 'action',
        label: 'Push',
        color: '#1473e6',
        fields: [
            { key: 'message', label: 'Message name', type: 'text', required: true },
            { key: 'surface', label: 'Channel surface', type: 'text' },
            { key: 'brief', label: 'Content brief', type: 'textarea' }
        ],
        what: 'Sends a mobile push notification.',
        why: 'Short, timely nudges for app users.',
        howInAjo: ['Drag "Push" from Actions, pick the push configuration and edit iOS/Android content.'],
        pitfalls: ['Only reaches profiles with a valid push token for that app.']
    },
    sms: {
        category: 'action',
        label: 'SMS',
        color: '#1473e6',
        fields: [
            { key: 'message', label: 'Message name', type: 'text', required: true },
            { key: 'surface', label: 'Channel surface', type: 'text' },
            { key: 'brief', label: 'Content brief', type: 'textarea' }
        ],
        what: 'Sends a text message.',
        why: 'High-urgency messages (appointments, delivery, OTP-style reminders).',
        howInAjo: ['Drag "SMS" from Actions, choose the SMS configuration and write the text.'],
        pitfalls: ['SMS consent and quiet hours are regulated in many countries.']
    },
    inApp: {
        category: 'action',
        label: 'In-app',
        color: '#1473e6',
        fields: [
            { key: 'message', label: 'Message name', type: 'text', required: true },
            { key: 'brief', label: 'Content brief', type: 'textarea' }
        ],
        what: 'Shows a message the next time the person opens the app.',
        why: 'Contextual messages without interrupting the user.',
        howInAjo: ['Drag "In-app message" from Actions and set the trigger and layout.'],
        pitfalls: ['The message is only shown while the person is still in the journey.']
    },
    customAction: {
        category: 'action',
        label: 'Custom action',
        color: '#1473e6',
        fields: [
            { key: 'actionName', label: 'Custom action', type: 'action', required: true },
            { key: 'payloadNotes', label: 'Payload mapping notes', type: 'textarea' }
        ],
        what: 'Calls an external API (CRM, ticketing, loyalty, ad platform) with journey data.',
        why: 'Keep other systems in sync or trigger channels AJO does not own.',
        howInAjo: [
            'Administration → Configurations → Actions: define the endpoint, auth and payload.',
            'Drag the custom action onto the canvas and map payload fields.'
        ],
        pitfalls: ['Respect the endpoint\'s rate limit - set capping on the action configuration.']
    },

    // ---------- End ----------
    end: {
        category: 'end',
        label: 'End',
        color: '#6b7280',
        fields: [],
        what: 'The person leaves the journey.',
        why: 'Every path must finish here.',
        howInAjo: ['AJO adds End automatically at the end of every path.'],
        pitfalls: []
    }
};

export const ENTRY_TYPES = Object.keys(ACTIVITIES).filter((k) => ACTIVITIES[k].category === 'entry');
export const MESSAGE_TYPES = ['email', 'push', 'sms', 'inApp'];
export const BRANCHING_TYPES = Object.keys(ACTIVITIES).filter((k) => ACTIVITIES[k].branching);

/** AJO guardrail: a journey can contain at most 50 activities. */
export const MAX_ACTIVITIES = 50;
export const MAX_WAIT_DAYS = 29;
