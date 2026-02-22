export interface KafkaClient {
    readonly mode: 'emulated';
}

export interface EventMessage {
    type: string;
    data: unknown;
}

export interface PublishPayload {
    topic: string;
    events: EventMessage[];
}

export interface TopicSubscription {
    topic: string;
    eventHandler: (event: unknown) => void;
}
