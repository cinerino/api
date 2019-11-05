"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function tttsReservation2chevre(params) {
    // ツアーナンバーを補完
    // if ((<any>params).performance_ttts_extension !== undefined
    //     && (<any>params).performance_ttts_extension !== null
    //     && typeof (<any>params).performance_ttts_extension.tour_number === 'string') {
    //     if (params.reservationFor === undefined || params.reservationFor === null) {
    //         params.reservationFor = <any>{};
    //     }
    //     if (!Array.isArray(params.reservationFor.additionalProperty)) {
    //         params.reservationFor.additionalProperty = [];
    //     }
    // tslint:disable-next-line:max-line-length
    //     params.reservationFor.additionalProperty.push({ name: 'tourNumber', value: (<any>params).performance_ttts_extension.tour_number });
    // }
    // // 劇場名を保管
    // if ((<any>params).theater_name !== undefined
    //     && (<any>params).theater_name !== null) {
    //     if (params.reservationFor === undefined || params.reservationFor === null) {
    //         params.reservationFor = <any>{};
    //     }
    //     if (params.reservationFor.superEvent === undefined || params.reservationFor.superEvent === null) {
    //         params.reservationFor.superEvent = <any>{};
    //     }
    //     if (params.reservationFor.superEvent.location === undefined || params.reservationFor.superEvent.location === null) {
    //         params.reservationFor.superEvent.location = <any>{};
    //     }
    //     params.reservationFor.superEvent.location.name = (<any>params).theater_name;
    // }
    // // 不要な属性を削除
    // delete (<any>params).theater;
    // delete (<any>params).theater_address;
    // delete (<any>params).theater_name;
    // delete (<any>params).screen;
    // delete (<any>params).screen_name;
    // delete (<any>params).film;
    // delete (<any>params).film_copyright;
    // delete (<any>params).film_is_mx4d;
    // delete (<any>params).film_name;
    // delete (<any>params).performance_canceled;
    // delete (<any>params).performance_day;
    // delete (<any>params).performance_door_time;
    // delete (<any>params).performance_end_date;
    // delete (<any>params).performance_end_time;
    // delete (<any>params).performance_open_time;
    // delete (<any>params).performance_start_date;
    // delete (<any>params).performance_start_time;
    // delete (<any>params).ticket_cancel_charge;
    // delete (<any>params).ticket_ttts_extension;
    // delete (<any>params).ticket_type;
    // delete (<any>params).ticket_type_charge;
    // delete (<any>params).ticket_type_name;
    return params;
}
exports.tttsReservation2chevre = tttsReservation2chevre;
