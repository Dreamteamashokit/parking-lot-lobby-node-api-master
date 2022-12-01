import Stripe from 'stripe';
import moment from 'moment';
import { User } from '../models';
import DBoperations from './DBoperations';

const stripe = new Stripe(process.env.STRIPE_SECRET);

module.exports = {
    chargeClient: (clientId, source) => {
        return new Promise(async (resolve, reject) => {
            try {
                const client = await getClient(clientId);
                const amount = Math.round(client.membership.amount * 100);
                const charge = await stripe.charges.create({
                    customer: client.stripe,
                    currency: 'usd',
                    amount,
                    source,
                });
                if (charge.status === 'succeeded' && charge.captured && charge.amount_captured === amount) {
                    const validity = moment().add(client.membership.plan, 'months').toDate();
                    console.log('validity', validity);
                    await DBoperations.findAndUpdate(User, { _id: clientId }, { membership: { ...client.membership, validity } });
                }
                return resolve(charge);
            } catch (error) {
                console.log(error);
                reject(error)
            }
        })
    },
    addCard: (clientId, payload) => {
        return new Promise(async (resolve, reject) => {
            try {
                const client = await getClient(clientId);
                const token = await stripe.tokens.create({ card: { object: 'card', ...payload } });
                const data = await stripe.customers.createSource(client.stripe, { source: token.id });
                resolve(data);
            } catch (error) {
                console.log(error)
                reject(error);
            }
        })
    },
    removeCard: (clientId, source) => {
        return new Promise(async (resolve, reject) => {
            try {
                const client = await getClient(clientId);
                const data = await stripe.customers.deleteSource(client.stripe, source);
                resolve(data);
            } catch (error) {
                console.log(error)
                reject(error);
            }
        })
    },
    getCards: async (clientId) => {
        try {
            const client = await getClient(clientId);
            const { data } = await stripe.customers.listSources(client.stripe, { object: 'card', limit: 10 });
            return data;
        } catch (error) {
            console.log(error)
            return [];
        }
    },
}
async function getClient(clientId) {
    let client = await DBoperations.findOne(User, { _id: clientId }, {}, {});
    try {
        if (client?.stripe) {
            const cc = await stripe.customers.retrieve(client.stripe);
            if (cc?.deleted) {
                throw Error();
            }
        }
    } catch (error) {
        client['stripe'] = null;
    }
    if (!client?.stripe) {
        const customer = await stripe.customers.create({
            name: `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || undefined,
            email: client.email,
            phone: client.fullNumber,
        });
        client = await DBoperations.findAndUpdate(User, { _id: client._id }, { stripe: customer?.id });
    }
    return client;
}