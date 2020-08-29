import * as functions from 'firebase-functions';
import * as FirebaseAdmin from 'firebase-admin';

import { scrapKumirMenu } from './scrapKumirMenu';
import { randomId, throwError } from './utils';
import { Menu, MenuTable } from '../../types/autoOrderMenus';

export const getUpdatedMenu = async (target: string): Promise<Menu> => {
    try {
        console.log('getUpdatedMenu');
        const docRef = FirebaseAdmin.firestore().collection(`auto-order-menus`).doc(target);
        console.log('docRef');
        const data = await docRef.get();
        console.log('data');
        const today = (new Date()).toDateString();
        if (data.exists) {
            const menuData = data.data() as MenuTable;
            if (menuData.updateDate === today) {
                return menuData.menu;
            }

            const todayMenuData = await scrapKumirMenu();
            todayMenuData.forEach(item => {
                const sameNameItem = menuData.menu.find(oldItem => oldItem.name === item.name);
                if (sameNameItem) {
                    sameNameItem.price = item.price;
                    sameNameItem.category = item.category;
                    sameNameItem.imageUrl = item.imageUrl;
                } else {
                    menuData.menu.push({
                        id: randomId(),
                        enabled: true,
                        ...item,
                    });
                }
            });
            const updatedMenu = menuData.menu.map(item => {
                const enabled = todayMenuData.find(todayItem => todayItem.name === item.name);
                return { ...item, enabled: !!enabled };
            });
            await docRef.update({
                updateDate: today,
                menu: updatedMenu,
            });
            return updatedMenu;
        }

        console.log('pre-scrap');
        const firstMenuData = await scrapKumirMenu();
        console.log('postScrap');
        const preparedMenu = firstMenuData.map(item => ({
            id: randomId(),
            enabled: true,
            ...item,
        }));
        functions.logger.info('updateMenu: pre-set');
        await docRef.set({
            updateDate: today,
            menu: preparedMenu,
        });
        functions.logger.info('updateMenu: after-set');
        return preparedMenu;

    } catch (e) {
        throwError('aborted', 'Unknown error in getting the updated menu', e);
    }
    return [];
};
