import { Subscription } from 'rxjs';
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { DiscussionService, CONTEXT_PROPS } from '../../services/discussion.service';
import { NSDiscussData } from './../../models/discuss.model';
import { Router, ActivatedRoute } from '@angular/router';
import { TelemetryUtilsService } from './../../telemetry-utils.service';

import * as CONSTANTS from './../../common/constants.json';
/* tslint:disable */
import * as _ from 'lodash'
import { ConfigService } from '../../services/config.service';
import { NavigationServiceService } from '../../navigation-service.service';
/* tslint:enable */

@Component({
  selector: 'lib-discuss-category',
  templateUrl: './discuss-category.component.html',
  styleUrls: ['./discuss-category.component.css']
})
export class DiscussCategoryComponent implements OnInit, OnDestroy {

  categories: NSDiscussData.ICategorie[] = [];

  forumIds: any;
  @Input() categoryIds;
  @Input() categoryAction;
  @Output() stateChange: EventEmitter<any> = new EventEmitter();

  pageId = 0;

  isTopicCreator = false;

  showStartDiscussionModal = false;

  categoryId: any;

  paramsSubscription: Subscription;

  showLoader = false;

  constructor(
    public discussService: DiscussionService,
    public configService: ConfigService,
    public router: Router,
    public activatedRoute: ActivatedRoute,
    private telemetryUtils: TelemetryUtilsService,
    private navigationService: NavigationServiceService
  ) { }

  ngOnInit() {
    /** It will look for the queryParams, if back button is clicked,
     * the queryParams will change and it will fetch the categories
     * if there is no queryParams available, then it will fetch the default categories of the forumIds
     */
    this.telemetryUtils.setContext([]);
    this.telemetryUtils.logImpression(NSDiscussData.IPageName.CATEGORY);
    this.forumIds = this.categoryIds ? this.categoryIds : this.discussService.forumIds;
    this.paramsSubscription = this.activatedRoute.queryParams.subscribe((params) => {
      if (_.get(params, 'cid')) {
        this.navigateToDiscussionPage(_.get(params, 'cid'));
      } else {
        this.categories = [];
        if (this.forumIds.length) {
          this.fetchAllAvailableCategories(this.forumIds);
        } else {
          this.fetchAllCategories();
        }
      }
    });
  }

  fetchAllAvailableCategories(ids) {
    this.showLoader = true;
    ids.forEach((cid) => {
      this.fetchCategory(cid).subscribe(data => {
        this.showLoader = false;
        this.categories.push(data);
      }, error => {
        // TODO: Toast error
        console.log('issue fetching category', error);
        this.showLoader = false;
      });
    });
  }

  fetchAllCategories() {
    this.showLoader = true;
    this.discussService.fetchAllCategories().subscribe(data => {
      this.showLoader = false;
      this.categories = data
    }, error => {
      // TODO: Toast error
      console.log('issue fetching category', error);
      this.showLoader = false;
    });
  }

  fetchCategory(cid) {
    return this.discussService.fetchSingleCategoryDetails(cid);
  }

  /**
   * It will fetch the children for each category click.
   * if there is no children available the it will redirect to the topic list page
   */
  navigateToDiscussionPage(cid, slug?) {
    this.showLoader = true;
    this.telemetryUtils.uppendContext({ id: cid, type: 'Category' });
    this.discussService.fetchSingleCategoryDetails(cid).subscribe(response => {
      this.showLoader = false;
      this.categoryId = _.get(response, 'cid');
      this.isTopicCreator = _.get(response, 'privileges.topics:create') === true ? true : false;
      this.showStartDiscussionModal = false;
      let input
      if (_.get(response, 'children').length > 0) {
        this.router.navigate([], { relativeTo: this.activatedRoute.parent, queryParams: { cid: this.categoryId } });

        // input = { data: { url: '', queryParams: { cid: this.categoryId } }, action: this.categoryAction}
        // this.navigationService.navigate(input)

        _.get(response, 'children').forEach(subCategoryData => {
          this.categories.push(subCategoryData);
        });
      } else {
        this.discussService.setContext(CONTEXT_PROPS.cid, this.categoryId);
        this.configService.setCategoryid(this.categoryId)

        let routerSlug = this.configService.getConfig().routerSlug ? this.configService.getConfig().routerSlug : ''
        input = { data: { url: `${routerSlug}${CONSTANTS.ROUTES.CATEGORY}${this.categoryId}`, queryParams: {} }, action: CONSTANTS.CATEGORY_HOME, }
        this.navigationService.navigate(input)
        this.stateChange.emit({ action: this.categoryAction, categoryId: this.categoryId })
      }
    }, error => {
      this.showLoader = false;
      // TODO: Toast error
      console.log('issue fetching category', error);
    });
  }

  startDiscussion() {
    this.showStartDiscussionModal = true;
  }

  closeModal(event) {
    this.showStartDiscussionModal = false;
  }

  logTelemetry(event) {
    this.telemetryUtils.logInteract(event, NSDiscussData.IPageName.CATEGORY);
  };

  ngOnDestroy() {
    if (this.paramsSubscription) {
      this.paramsSubscription.unsubscribe();
    }
  }
}
