/**
 * Starter journey skeletons. Event/audience names are placeholders - the editor and the
 * validator flag any that don't exist in the loaded sandbox context.
 */
export const TEMPLATES = [
    {
        id: 'welcome',
        name: 'Welcome series',
        summary: 'Account created → welcome email → nudge non-clickers → tag as onboarded.',
        journey: {
            name: 'Welcome series',
            description: 'Three-touch welcome for new sign-ups.',
            entry: 'start',
            nodes: [
                { id: 'start', type: 'unitaryEvent', label: 'Account created', config: { eventName: 'accountCreated', reentrance: 'not allowed' }, next: 'email1' },
                { id: 'email1', type: 'email', label: 'Welcome email', config: { message: 'Welcome - getting started', brief: 'Thank them, 3 quick-start tips, link to profile completion.' }, next: 'react1' },
                { id: 'react1', type: 'reaction', label: 'Clicked welcome?', config: { toMessage: 'email1', timeoutDays: 3 }, paths: [{ label: 'Clicked', next: 'wait2' }, { label: 'No click in 3 days', timeout: true, next: 'push1' }] },
                { id: 'push1', type: 'push', label: 'Reminder push', config: { message: 'Finish setting up', brief: 'Short reminder to complete profile.' }, next: 'wait2' },
                { id: 'wait2', type: 'wait', label: 'Wait 4 days', config: { amount: 4, unit: 'days' }, next: 'email2' },
                { id: 'email2', type: 'email', label: 'Feature highlights', config: { message: 'Welcome - what you can do', brief: 'Top 3 features with one CTA each.' }, next: 'tag' },
                { id: 'tag', type: 'updateProfile', label: 'Mark onboarded', config: { field: 'journeyStatus.welcomeCompleted', value: 'true' }, next: 'end' },
                { id: 'end', type: 'end', label: 'End' }
            ]
        }
    },
    {
        id: 'cart',
        name: 'Abandoned cart',
        summary: 'Cart abandoned → wait → stop if purchased → reminder → VIP incentive.',
        journey: {
            name: 'Abandoned cart recovery',
            description: 'Recover carts abandoned for over an hour, with an incentive for loyalty members.',
            entry: 'start',
            nodes: [
                { id: 'start', type: 'unitaryEvent', label: 'Cart abandoned', config: { eventName: 'cartAbandoned', reentrance: 'allowed after wait', reentryWaitDays: 3 }, next: 'buy' },
                { id: 'buy', type: 'eventWait', label: 'Purchased within 1 day?', config: { eventName: 'orderPlaced', timeoutDays: 1 }, paths: [{ label: 'Purchased', next: 'endBought' }, { label: 'No purchase', timeout: true, next: 'email1' }] },
                { id: 'email1', type: 'email', label: 'You left something behind', config: { message: 'Cart reminder', brief: 'Show cart items (from event context), single CTA back to cart.' }, next: 'wait1' },
                { id: 'wait1', type: 'wait', label: 'Wait 1 day', config: { amount: 1, unit: 'days' }, next: 'vip' },
                { id: 'vip', type: 'condition', label: 'Loyalty member?', config: { kind: 'data source' }, paths: [{ label: 'Loyalty member', expression: 'loyalty.tier in ["gold","platinum"]', next: 'email2' }, { label: 'Other cases', otherwise: true, next: 'push1' }] },
                { id: 'email2', type: 'email', label: 'Incentive email', config: { message: 'Cart reminder - 10% off', brief: 'Personal offer code, expires in 48h.' }, next: 'end1' },
                { id: 'push1', type: 'push', label: 'Last-chance push', config: { message: 'Items selling fast', brief: 'Low-stock urgency, no discount.' }, next: 'end2' },
                { id: 'endBought', type: 'end', label: 'End' },
                { id: 'end1', type: 'end', label: 'End' },
                { id: 'end2', type: 'end', label: 'End' }
            ]
        }
    },
    {
        id: 'winback',
        name: 'Win-back',
        summary: 'Lapsed audience (weekly) → A/B split on offer → follow-up for non-clickers.',
        journey: {
            name: 'Win-back lapsed customers',
            description: 'Weekly read of lapsed customers with an A/B test on the offer.',
            entry: 'start',
            nodes: [
                { id: 'start', type: 'readAudience', label: 'Lapsed 90 days', config: { audienceName: 'Lapsed customers 90d', schedule: 'weekly' }, next: 'split' },
                { id: 'split', type: 'condition', label: 'A/B offer test', config: { kind: 'percentage split' }, paths: [{ label: 'A - 15% off', percent: 50, next: 'emailA' }, { label: 'B - free shipping', percent: 50, next: 'emailB' }] },
                { id: 'emailA', type: 'email', label: 'We miss you - 15% off', config: { message: 'Win-back A', brief: 'Emotional subject, 15% code.' }, next: 'endA' },
                { id: 'emailB', type: 'email', label: 'We miss you - free shipping', config: { message: 'Win-back B', brief: 'Free shipping on next order.' }, next: 'endB' },
                { id: 'endA', type: 'end', label: 'End' },
                { id: 'endB', type: 'end', label: 'End' }
            ]
        }
    },
    {
        id: 'birthday',
        name: 'Birthday',
        summary: 'Daily read of birthday audience → email → SMS for opted-in members.',
        journey: {
            name: 'Birthday greeting',
            description: 'Daily birthday greeting with an SMS for members who opted in.',
            entry: 'start',
            nodes: [
                { id: 'start', type: 'readAudience', label: 'Birthday today', config: { audienceName: 'Birthday today', schedule: 'daily' }, next: 'email' },
                { id: 'email', type: 'email', label: 'Happy birthday', config: { message: 'Birthday greeting', brief: 'Personal greeting with birthday reward.' }, next: 'sms?' },
                { id: 'sms?', type: 'condition', label: 'SMS opted in?', config: { kind: 'data source' }, paths: [{ label: 'Opted in', expression: 'consents.marketing.sms.val = "y"', next: 'sms' }, { label: 'Other cases', otherwise: true, next: 'end2' }] },
                { id: 'sms', type: 'sms', label: 'Birthday SMS', config: { message: 'Birthday SMS', brief: 'One line + reward link.' }, next: 'end1' },
                { id: 'end1', type: 'end', label: 'End' },
                { id: 'end2', type: 'end', label: 'End' }
            ]
        }
    },
    {
        id: 'vip',
        name: 'VIP qualification',
        summary: 'Enters VIP audience → welcome to VIP → notify CRM via custom action.',
        journey: {
            name: 'New VIP onboarding',
            description: 'Celebrate customers who reach VIP status and sync CRM.',
            entry: 'start',
            nodes: [
                { id: 'start', type: 'audienceQualification', label: 'Became VIP', config: { audienceName: 'VIP customers', behavior: 'enters audience' }, next: 'crm' },
                { id: 'crm', type: 'customAction', label: 'Notify CRM', config: { actionName: 'CRM - create VIP task', payloadNotes: 'customerId, tier, lifetimeValue' }, next: 'email' },
                { id: 'email', type: 'email', label: 'Welcome to VIP', config: { message: 'VIP welcome', brief: 'Benefits overview, dedicated contact.' }, next: 'end' },
                { id: 'end', type: 'end', label: 'End' }
            ]
        }
    }
];
